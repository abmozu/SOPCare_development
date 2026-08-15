import { ensureDatabase, writeAudit } from "../../../../../db/runtime";
import { apiError, cleanText, requireApiActor, requireClinicalWriteRole } from "../../../_utils";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireApiActor("clinical.notes.edit");
  if (actor instanceof Response) return actor;
  const forbidden = requireClinicalWriteRole(actor);
  if (forbidden) return forbidden;

  try {
    const { id } = await context.params;
    const payload = await request.json() as Record<string, unknown>;
    const decisionNote = cleanText(payload.decisionNote, 1200);
    const criteriaMet = payload.criteriaMet === true || payload.criteriaMet === "on";
    if (!criteriaMet || !decisionNote) {
      return Response.json({ error: "Confirm the exit criteria and record the clinical decision." }, { status: 400 });
    }

    const db = await ensureDatabase();
    const plan = await db.prepare(`SELECT rp.title, rp.injury_id AS injuryId, rp.current_phase AS currentPhase, rp.status,
      i.stage AS injuryStage, i.athlete_id AS athleteId
      FROM rehabilitation_plans rp JOIN injury_episodes i ON i.id = rp.injury_id WHERE rp.id = ?`).bind(id)
      .first<{ title: string; injuryId: string; currentPhase: number; status: string; injuryStage: string; athleteId: string }>();
    if (!plan) return Response.json({ error: "Rehabilitation plan not found." }, { status: 404 });
    if (plan.status !== "Active") return Response.json({ error: "This rehabilitation plan is not active." }, { status: 400 });
    const phases = await db.prepare("SELECT id, phase_number AS phaseNumber, title, progress FROM rehabilitation_phases WHERE plan_id = ? ORDER BY phase_number")
      .bind(id).all<{ id: string; phaseNumber: number; title: string; progress: number }>();
    const phaseRows = phases.results as Array<{ id: string; phaseNumber: number; title: string; progress: number }>;
    const current = phaseRows.find((phase) => phase.phaseNumber === plan.currentPhase);
    if (!current) return Response.json({ error: "Current phase not found." }, { status: 404 });
    if (current.progress < 100) return Response.json({ error: "Complete all current phase milestones before moving to the next phase." }, { status: 400 });

    const next = phaseRows.find((phase) => phase.phaseNumber === plan.currentPhase + 1);
    const now = new Date().toISOString();
    const statements = [db.prepare("UPDATE rehabilitation_phases SET status = 'Complete', progress = 100, completed_at = ?, updated_at = ? WHERE id = ?").bind(now, now, current.id)];
    if (next) {
      const overall = Math.round((plan.currentPhase * 100) / phaseRows.length);
      statements.push(db.prepare("UPDATE rehabilitation_phases SET status = 'Active', started_at = ?, updated_at = ? WHERE id = ?").bind(now, now, next.id));
      statements.push(db.prepare("UPDATE rehabilitation_plans SET current_phase = ?, overall_progress = ?, updated_at = ? WHERE id = ?").bind(next.phaseNumber, overall, now, id));
    } else {
      statements.push(db.prepare("UPDATE rehabilitation_plans SET status = 'Completed', overall_progress = 100, updated_at = ? WHERE id = ?").bind(now, id));
      const closureSummary = `Rehabilitation pathway completed. ${decisionNote}`;
      statements.push(db.prepare("UPDATE injury_episodes SET stage = 'Closed', participation_status = 'Available', next_action = 'Rehabilitation pathway completed', closure_summary = ?, closed_at = ?, updated_at = ? WHERE id = ?").bind(closureSummary, now, now, plan.injuryId));
      statements.push(db.prepare("UPDATE athletes SET status = 'Available', follow_up_date = NULL, updated_at = ? WHERE id = ?").bind(now, plan.athleteId));
      const actorRow = await db.prepare("SELECT id FROM users WHERE id = ?").bind(actor.id).first<{ id: string }>();
      statements.push(db.prepare("INSERT INTO injury_status_history (id, injury_id, from_stage, to_stage, note, changed_by, created_at) VALUES (?, ?, ?, 'Closed', ?, ?, ?)")
        .bind(crypto.randomUUID(), plan.injuryId, plan.injuryStage, closureSummary, actorRow?.id ?? "user-lina", now));
    }
    await db.batch(statements);
    await writeAudit(actor.id, next ? "PHASE_ADVANCED" : "PLAN_COMPLETED", "rehabilitation_plan", id, next ? `${plan.title} advanced to ${next.title}: ${decisionNote}` : `${plan.title} completed: ${decisionNote}`);
    return Response.json({ id, completed: !next });
  } catch (error) {
    return apiError(error);
  }
}
