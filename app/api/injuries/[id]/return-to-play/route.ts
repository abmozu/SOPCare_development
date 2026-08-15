import { ensureDatabase, writeAudit } from "../../../../../db/runtime";
import { apiError, cleanText, requireApiActor } from "../../../_utils";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireApiActor("clinical.notes.edit");
  if (actor instanceof Response) return actor;
  if (!/physician|doctor/i.test(actor.specialty)) return Response.json({ error: "Only a physician can authorize return to play." }, { status: 403 });
  try {
    const { id } = await context.params;
    const payload = await request.json() as Record<string, unknown>;
    const decision = cleanText(payload.decision, 80);
    const note = cleanText(payload.note, 1600);
    const restrictions = cleanText(payload.restrictions, 1200);
    if (!note || !["Authorized — full return", "Authorized with restrictions", "Further medical review required", "Not authorized"].includes(decision)) return Response.json({ error: "Select a decision and record the medical rationale." }, { status: 400 });
    const db = await ensureDatabase();
    const injury = await db.prepare("SELECT i.stage, i.athlete_id AS athleteId, rp.id AS planId FROM injury_episodes i JOIN rehabilitation_plans rp ON rp.injury_id = i.id WHERE i.id = ? AND rp.status = 'Awaiting medical clearance'").bind(id).first<{ stage: string; athleteId: string; planId: string }>();
    if (!injury) return Response.json({ error: "This injury is not awaiting a medical return-to-play decision." }, { status: 400 });
    const now = new Date().toISOString();
    const authorized = decision.startsWith("Authorized");
    const summary = `${decision}. ${note}${restrictions ? ` Restrictions: ${restrictions}` : ""}`;
    await db.batch([
      db.prepare("INSERT INTO return_to_play_decisions (id, injury_id, plan_id, decision, restrictions, note, decided_by, decided_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), id, injury.planId, decision, restrictions, note, actor.id, now),
      db.prepare("UPDATE rehabilitation_plans SET status = ?, updated_at = ? WHERE id = ?").bind(authorized ? "Completed" : "Awaiting medical clearance", now, injury.planId),
      db.prepare("UPDATE injury_episodes SET stage = ?, participation_status = ?, next_action = ?, closure_summary = ?, closed_at = ?, updated_at = ? WHERE id = ?").bind(authorized ? "Closed" : "Return-to-Sport Review", authorized ? (decision === "Authorized with restrictions" ? "Modified Training" : "Available") : "Return-to-Sport Review", authorized ? "Return-to-play decision completed" : "Further medical review required", summary, authorized ? now : null, now, id),
      ...(authorized ? [db.prepare("UPDATE athletes SET status = ?, updated_at = ? WHERE id = ?").bind(decision === "Authorized with restrictions" ? "Modified Training" : "Available", now, injury.athleteId)] : []),
      db.prepare("UPDATE clinical_tasks SET status = 'Completed', completed_at = ? WHERE injury_id = ? AND task_type = 'return_to_play' AND status = 'Open'").bind(now, id),
      db.prepare("INSERT INTO injury_status_history (id, injury_id, from_stage, to_stage, note, changed_by, created_at) VALUES (?, ?, 'Closed', ?, ?, ?, ?)").bind(crypto.randomUUID(), id, authorized ? "Return-to-Sport Review" : "Return-to-Sport Review", summary, actor.id, now),
    ]);
    await writeAudit(actor.id, "RETURN_TO_PLAY_DECISION", "injury_episode", id, summary);
    return Response.json({ authorized });
  } catch (error) { return apiError(error); }
}
