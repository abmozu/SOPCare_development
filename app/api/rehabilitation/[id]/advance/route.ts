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
    if (current.progress < 80) return Response.json({ error: "Current phase progress must reach at least 80% before advancement." }, { status: 400 });

    const next = phaseRows.find((phase) => phase.phaseNumber === plan.currentPhase + 1);
    const now = new Date().toISOString();
    const statements = [db.prepare("UPDATE rehabilitation_phases SET status = 'Complete', progress = 100, completed_at = ?, updated_at = ? WHERE id = ?").bind(now, now, current.id)];
    if (next) {
      const overall = Math.round((plan.currentPhase * 100) / phaseRows.length);
      statements.push(db.prepare("UPDATE rehabilitation_phases SET status = 'Active', started_at = ?, updated_at = ? WHERE id = ?").bind(now, now, next.id));
      statements.push(db.prepare("UPDATE rehabilitation_plans SET current_phase = ?, overall_progress = ?, updated_at = ? WHERE id = ?").bind(next.phaseNumber, overall, now, id));
    } else {
      const clearanceSummary = `Rehabilitation completed. Medical return-to-play decision required. ${decisionNote}`;
      statements.push(db.prepare("UPDATE rehabilitation_plans SET status = 'Awaiting medical clearance', overall_progress = 100, updated_at = ? WHERE id = ?").bind(now, id));
      statements.push(db.prepare("UPDATE injury_episodes SET stage = 'Return-to-Sport Review', participation_status = 'Return-to-Sport Review', next_action = 'Medical return-to-play decision required', closure_summary = ?, updated_at = ? WHERE id = ?").bind(clearanceSummary, now, plan.injuryId));
      statements.push(db.prepare("INSERT INTO injury_status_history (id, injury_id, from_stage, to_stage, note, changed_by, created_at) VALUES (?, ?, ?, 'Return-to-Sport Review', ?, ?, ?)")
        .bind(crypto.randomUUID(), plan.injuryId, plan.injuryStage, clearanceSummary, actor.id, now));
      const physicians = await db.prepare(`
        SELECT DISTINCT u.id
        FROM users u
        JOIN practitioner_profiles pp ON pp.user_id = u.id
        WHERE pp.specialty ILIKE '%medicine%' OR pp.specialty ILIKE '%physician%'
      `).all<{ id: string }>();
      for (const physician of physicians.results) statements.push(db.prepare("INSERT INTO clinical_tasks (id, recipient_user_id, task_type, title, detail, injury_id, plan_id, status, created_at) VALUES (?, ?, 'return_to_play', ?, ?, ?, ?, 'Open', ?)")
        .bind(crypto.randomUUID(), physician.id, "Return-to-play decision required", `${plan.title} has completed rehabilitation and awaits your medical decision.`, plan.injuryId, id, now));
    }
    await db.batch(statements);
    await writeAudit(actor.id, next ? "PHASE_ADVANCED" : "PLAN_COMPLETED", "rehabilitation_plan", id, next ? `${plan.title} advanced to ${next.title}: ${decisionNote}` : `${plan.title} completed: ${decisionNote}`);
    return Response.json({ id, completed: !next });
  } catch (error) {
    return apiError(error);
  }
}
