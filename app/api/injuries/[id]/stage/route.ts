import { ensureDatabase, writeAudit } from "../../../../../db/runtime";
import { apiError, cleanText, requireApiActor, requireClinicalWriteRole } from "../../../_utils";

const stages = ["New", "Under Assessment", "Under Treatment", "Modified Training", "Return-to-Sport Review", "Closed"];
const participationStatuses = ["Available", "Modified Training", "Under Treatment", "Return-to-Sport Review", "Unavailable"];

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireApiActor("clinical.notes.edit");
  if (actor instanceof Response) return actor;
  const forbidden = requireClinicalWriteRole(actor);
  if (forbidden) return forbidden;

  try {
    const { id } = await context.params;
    const payload = await request.json() as Record<string, unknown>;
    const stage = cleanText(payload.stage, 60);
    const participationStatus = cleanText(payload.participationStatus, 60);
    const nextAction = cleanText(payload.nextAction, 1000);
    const note = cleanText(payload.note, 1000) || `Stage updated to ${stage}.`;
    const reviewDate = cleanText(payload.reviewDate, 10) || null;
    const expectedReturnDate = cleanText(payload.expectedReturnDate, 10) || null;
    const closureSummary = cleanText(payload.closureSummary, 2000) || null;

    if (!stages.includes(stage) || !participationStatuses.includes(participationStatus) || !nextAction) {
      return Response.json({ error: "Stage, participation, and next action are required." }, { status: 400 });
    }
    if (stage === "Closed" && !closureSummary) {
      return Response.json({ error: "A closure summary is required before closing an episode." }, { status: 400 });
    }

    const db = await ensureDatabase();
    const injury = await db.prepare("SELECT athlete_id AS athleteId, title, stage FROM injury_episodes WHERE id = ?")
      .bind(id).first<{ athleteId: string; title: string; stage: string }>();
    if (!injury) return Response.json({ error: "Injury episode not found." }, { status: 404 });
    const actorRow = await db.prepare("SELECT id FROM users WHERE id = ?").bind(actor.id).first<{ id: string }>();
    const databaseActorId = actorRow?.id ?? "user-lina";
    const now = new Date().toISOString();
    await db.batch([
      db.prepare(`UPDATE injury_episodes SET stage = ?, participation_status = ?, next_action = ?, review_date = ?, expected_return_date = ?, closure_summary = ?, closed_at = ?, updated_at = ? WHERE id = ?`)
        .bind(stage, participationStatus, nextAction, reviewDate, expectedReturnDate, closureSummary, stage === "Closed" ? now : null, now, id),
      db.prepare("INSERT INTO injury_status_history (id, injury_id, from_stage, to_stage, note, changed_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), id, injury.stage, stage, note, databaseActorId, now),
      db.prepare("UPDATE athletes SET status = ?, follow_up_date = ?, updated_at = ? WHERE id = ?")
        .bind(stage === "Closed" ? "Available" : participationStatus === "Unavailable" ? "Temporarily Unavailable" : participationStatus, stage === "Closed" ? null : reviewDate, now, injury.athleteId),
    ]);
    await writeAudit(actor.id, stage === "Closed" ? "CLOSED" : "STAGE_UPDATED", "injury", id, `${injury.title} moved from ${injury.stage} to ${stage}`);
    return Response.json({ id });
  } catch (error) {
    return apiError(error);
  }
}
