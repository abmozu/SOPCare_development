import { ensureDatabase, writeAudit } from "../../../db/runtime";
import { apiError, cleanText, requireApiActor, requireClinicalWriteRole } from "../_utils";

const diagnosisStatuses = ["Suspected", "Confirmed"];
const severities = ["Mild", "Moderate", "Severe"];
const participationStatuses = ["Available", "Modified Training", "Under Treatment", "Return-to-Sport Review", "Unavailable"];

export async function POST(request: Request) {
  const actor = await requireApiActor("clinical.notes.create");
  if (actor instanceof Response) return actor;
  const forbidden = requireClinicalWriteRole(actor);
  if (forbidden) return forbidden;

  try {
    const payload = await request.json() as Record<string, unknown>;
    const athleteId = cleanText(payload.athleteId, 80);
    const leadPractitionerId = cleanText(payload.leadPractitionerId, 80);
    const title = cleanText(payload.title, 160);
    const diagnosisStatus = cleanText(payload.diagnosisStatus, 40);
    const bodyArea = cleanText(payload.bodyArea, 100);
    const laterality = cleanText(payload.laterality, 40) || "Not applicable";
    const onsetDate = cleanText(payload.onsetDate, 10);
    const mechanism = cleanText(payload.mechanism, 500);
    const severity = cleanText(payload.severity, 30);
    const participationStatus = cleanText(payload.participationStatus, 60);
    const nextAction = cleanText(payload.nextAction, 1000);
    const reviewDate = cleanText(payload.reviewDate, 10) || null;
    const expectedReturnDate = cleanText(payload.expectedReturnDate, 10) || null;

    if (!athleteId || !leadPractitionerId || !title || !bodyArea || !onsetDate || !mechanism || !nextAction) {
      return Response.json({ error: "Complete all required injury fields." }, { status: 400 });
    }
    if (!diagnosisStatuses.includes(diagnosisStatus) || !severities.includes(severity) || !participationStatuses.includes(participationStatus)) {
      return Response.json({ error: "One or more injury values are invalid." }, { status: 400 });
    }

    const db = await ensureDatabase();
    const athlete = await db.prepare("SELECT first_name AS firstName, last_name AS lastName FROM athletes WHERE id = ?")
      .bind(athleteId).first<{ firstName: string; lastName: string }>();
    const practitioner = await db.prepare("SELECT id FROM practitioner_profiles WHERE id = ?").bind(leadPractitionerId).first();
    if (!athlete) return Response.json({ error: "Athlete not found." }, { status: 404 });
    if (!practitioner) return Response.json({ error: "Lead practitioner not found." }, { status: 404 });

    const id = crypto.randomUUID();
    const historyId = crypto.randomUUID();
    const actorRow = await db.prepare("SELECT id FROM users WHERE id = ?").bind(actor.id).first<{ id: string }>();
    const databaseActorId = actorRow?.id ?? "user-lina";
    const now = new Date().toISOString();
    await db.batch([
      db.prepare(`INSERT INTO injury_episodes (id, athlete_id, lead_practitioner_id, title, diagnosis_status, body_area, laterality, onset_date, mechanism, severity, participation_status, stage, next_action, review_date, expected_return_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?, ?, ?, ?, ?)`)
        .bind(id, athleteId, leadPractitionerId, title, diagnosisStatus, bodyArea, laterality, onsetDate, mechanism, severity, participationStatus, nextAction, reviewDate, expectedReturnDate, now, now),
      db.prepare("INSERT INTO injury_status_history (id, injury_id, from_stage, to_stage, note, changed_by, created_at) VALUES (?, ?, NULL, 'New', ?, ?, ?)")
        .bind(historyId, id, "Injury episode opened.", databaseActorId, now),
      db.prepare("UPDATE athletes SET status = ?, follow_up_date = ?, updated_at = ? WHERE id = ?")
        .bind(participationStatus === "Unavailable" ? "Temporarily Unavailable" : participationStatus, reviewDate, now, athleteId),
    ]);
    await writeAudit(actor.id, "CREATED", "injury", id, `Injury episode opened for ${athlete.firstName} ${athlete.lastName}: ${title}`);
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
