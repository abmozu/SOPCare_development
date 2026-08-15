import { ensureDatabase, writeAudit } from "../../../../../db/runtime";
import { apiError, cleanText, requireApiActor, requireClinicalWriteRole } from "../../../_utils";

function score(value: unknown, max = 10) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(max, Math.round(parsed))) : null;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireApiActor("clinical.notes.create");
  if (actor instanceof Response) return actor;
  const forbidden = requireClinicalWriteRole(actor);
  if (forbidden) return forbidden;

  try {
    const { id } = await context.params;
    const payload = await request.json() as Record<string, unknown>;
    const sessionDate = cleanText(payload.sessionDate, 25);
    const sessionType = cleanText(payload.sessionType, 120);
    const status = payload.status === "Scheduled" ? "Scheduled" : "Completed";
    const notes = cleanText(payload.notes, 2000);
    const nextAction = cleanText(payload.nextAction, 1000);
    const loadScore = score(payload.loadScore);
    const painPre = score(payload.painPre);
    const painPost = score(payload.painPost);
    const milestoneIds = Array.isArray(payload.milestoneIds) ? payload.milestoneIds.map((value) => cleanText(value, 80)).filter(Boolean) : cleanText(payload.milestoneIds, 80) ? [cleanText(payload.milestoneIds, 80)] : [];
    if (!sessionDate || !sessionType || !nextAction) {
      return Response.json({ error: "Session date, type, and next action are required." }, { status: 400 });
    }
    if (status === "Completed" && (loadScore === null || painPre === null || painPost === null)) {
      return Response.json({ error: "Completed sessions require load and pain scores." }, { status: 400 });
    }

    const db = await ensureDatabase();
    const plan = await db.prepare("SELECT title, current_phase AS currentPhase, status FROM rehabilitation_plans WHERE id = ?")
      .bind(id).first<{ title: string; currentPhase: number; status: string }>();
    if (!plan) return Response.json({ error: "Rehabilitation plan not found." }, { status: 404 });
    if (plan.status !== "Active") return Response.json({ error: "Only active plans can receive sessions." }, { status: 400 });
    const phase = await db.prepare("SELECT id, progress FROM rehabilitation_phases WHERE plan_id = ? AND phase_number = ?")
      .bind(id, plan.currentPhase).first<{ id: string; progress: number }>();
    if (!phase) return Response.json({ error: "Current rehabilitation phase not found." }, { status: 404 });
    if (phase.progress >= 100) return Response.json({ error: "Complete the current phase before recording another session." }, { status: 400 });
    const practitioner = await db.prepare("SELECT id FROM practitioner_profiles WHERE user_id = ?").bind(actor.id).first<{ id: string }>();
    const practitionerId = practitioner?.id ?? "pr-lina";
    const phaseCount = await db.prepare("SELECT COUNT(*) AS count FROM rehabilitation_phases WHERE plan_id = ?").bind(id).first<{ count: number }>();
    const now = new Date().toISOString();
    const sessionId = crypto.randomUUID();
    const statements = [
      db.prepare(`INSERT INTO rehabilitation_sessions (id, plan_id, phase_id, practitioner_id, session_date, session_type, status, load_score, pain_pre, pain_post, phase_progress, notes, next_action, completed_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(sessionId, id, phase.id, practitionerId, sessionDate, sessionType, status, loadScore, painPre, painPost, null, notes, nextAction, status === "Completed" ? now : null, now, now),
    ];
    if (status === "Completed") {
      if (milestoneIds.length) statements.push(db.prepare(`UPDATE rehabilitation_exercises SET status = 'Complete' WHERE phase_id = ? AND id IN (${milestoneIds.map(() => "?").join(",")})`).bind(phase.id, ...milestoneIds));
      const milestones = await db.prepare("SELECT id, status FROM rehabilitation_exercises WHERE phase_id = ?").bind(phase.id).all<{ id: string; status: string }>();
      const milestoneRows = milestones.results ?? [];
      const completedMilestones = milestoneRows.filter((item) => item.status === "Complete" || milestoneIds.includes(item.id)).length;
      const phaseProgress = milestoneRows.length > 0 ? Math.round((completedMilestones * 100) / milestoneRows.length) : 0;
      const overallProgress = Math.round((((plan.currentPhase - 1) * 100) + phaseProgress) / Math.max(1, phaseCount?.count ?? 1));
      statements.push(db.prepare("UPDATE rehabilitation_phases SET progress = ?, updated_at = ? WHERE id = ?").bind(phaseProgress, now, phase.id));
      statements.push(db.prepare("UPDATE rehabilitation_plans SET overall_progress = ?, updated_at = ? WHERE id = ?").bind(overallProgress, now, id));
    }
    await db.batch(statements);
    await writeAudit(actor.id, status === "Completed" ? "SESSION_COMPLETED" : "SESSION_SCHEDULED", "rehabilitation_plan", id, `${sessionType} ${status.toLowerCase()} for ${plan.title}`);
    return Response.json({ id: sessionId }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
