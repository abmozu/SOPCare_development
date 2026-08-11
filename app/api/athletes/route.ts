import { ensureDatabase, writeAudit } from "../../../db/runtime";
import { apiError, cleanText, requireApiActor } from "../_utils";

export async function POST(request: Request) {
  const actor = await requireApiActor("athletes.create");
  if (actor instanceof Response) return actor;

  try {
    const payload = await request.json() as Record<string, unknown>;
    const firstName = cleanText(payload.firstName, 80);
    const lastName = cleanText(payload.lastName, 80);
    const dateOfBirth = cleanText(payload.dateOfBirth, 10);
    const sex = cleanText(payload.sex, 20);
    const sportId = cleanText(payload.sportId, 80);
    const discipline = cleanText(payload.discipline, 100);
    const teamId = cleanText(payload.teamId, 80);
    const dominantSide = cleanText(payload.dominantSide, 20) || "Right";

    if (!firstName || !lastName || !dateOfBirth || !sex || !sportId || !discipline || !teamId) {
      return Response.json({ error: "Complete all required athlete fields." }, { status: 400 });
    }

    const db = await ensureDatabase();
    const id = crypto.randomUUID();
    const row = await db.prepare("SELECT COUNT(*) AS count FROM athletes").first<{ count: number }>();
    const mrn = `SOP-${String(240060 + (row?.count ?? 0)).padStart(6, "0")}`;
    const accents = ["#006C46", "#397F91", "#BB7B43", "#6A5E8C", "#A45D65"];

    await db.batch([
      db.prepare(`INSERT INTO athletes (id, mrn, first_name, last_name, date_of_birth, sex, sport_id, discipline, dominant_side, status, medical_alerts, emergency_contact, accent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Available', 'None recorded', 'Not provided', ?)`)
        .bind(id, mrn, firstName, lastName, dateOfBirth, sex, sportId, discipline, dominantSide, accents[(row?.count ?? 0) % accents.length]),
      db.prepare("INSERT INTO athlete_team_memberships (athlete_id, team_id, is_primary) VALUES (?, ?, 1)").bind(id, teamId),
      db.prepare("INSERT OR IGNORE INTO athlete_care_team (athlete_id, practitioner_id, is_lead) VALUES (?, 'pr-lina', 1)").bind(id),
    ]);
    await writeAudit(actor.id, "CREATED", "athlete", id, `Athlete profile created for ${firstName} ${lastName}`);

    return Response.json({ id, mrn }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
