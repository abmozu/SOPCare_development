import { ensureDatabase, writeAudit } from "../../../db/runtime";
import { apiError, cleanText, requireApiActor } from "../_utils";

export async function POST(request: Request) {
  const actor = await requireApiActor("clinical.notes.create");
  if (actor instanceof Response) return actor;

  try {
    const payload = await request.json() as Record<string, unknown>;
    const athleteId = cleanText(payload.athleteId, 80);
    const encounterType = cleanText(payload.encounterType, 100);
    const clinicCity = cleanText(payload.clinicCity, 40);
    const clinicType = cleanText(payload.clinicType, 100);
    const clinicLocation = cleanText(payload.clinicLocation, 160);
    const reason = cleanText(payload.reason, 500);
    const diagnosis = cleanText(payload.diagnosis, 1000);
    const visibility = payload.visibility === "Restricted" ? "Restricted" : "Care team";
    if (!athleteId || !encounterType || !clinicCity || !clinicType || !clinicLocation || !reason || !diagnosis) {
      return Response.json({ error: "Athlete, clinic details, reason, and free-text diagnosis are required." }, { status: 400 });
    }
    if (!["Dammam", "Riyadh", "Dhahran"].includes(clinicCity)) {
      return Response.json({ error: "Choose Dammam, Riyadh, or Dhahran as the clinic city." }, { status: 400 });
    }

    const db = await ensureDatabase();
    const athlete = await db.prepare("SELECT first_name AS firstName, last_name AS lastName FROM athletes WHERE id = ?")
      .bind(athleteId).first<{ firstName: string; lastName: string }>();
    if (!athlete) return Response.json({ error: "Athlete not found." }, { status: 404 });

    let practitioner = await db.prepare(`SELECT pp.id FROM practitioner_profiles pp JOIN users u ON u.id = pp.user_id
      WHERE u.id = ? OR u.email = ? LIMIT 1`).bind(actor.id, actor.email).first<{ id: string }>();
    if (!practitioner) {
      await db.prepare("INSERT OR IGNORE INTO users (id, email, full_name) VALUES (?, ?, ?)").bind(actor.id, actor.email, actor.name).run();
      const user = await db.prepare("SELECT id FROM users WHERE id = ? OR email = ? LIMIT 1").bind(actor.id, actor.email).first<{ id: string }>();
      if (!user) return Response.json({ error: "The current practitioner account could not be resolved." }, { status: 400 });
      const practitionerId = `pr-${crypto.randomUUID()}`;
      await db.prepare("INSERT INTO practitioner_profiles (id, user_id, specialty, credentials) VALUES (?, ?, ?, ?)")
        .bind(practitionerId, user.id, actor.specialty, "SOPCare practitioner").run();
      practitioner = { id: practitionerId };
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.prepare(`INSERT INTO encounters (id, athlete_id, practitioner_id, encounter_date, encounter_type, clinic_city, clinic_type, clinic_location, reason, subjective, objective, assessment, plan, diagnosis, visibility, follow_up_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, athleteId, practitioner.id, now, encounterType, clinicCity, clinicType, clinicLocation, reason, cleanText(payload.subjective), cleanText(payload.objective), cleanText(payload.assessment), cleanText(payload.plan), diagnosis, visibility, cleanText(payload.followUpDate, 10) || null)
      .run();
    await writeAudit(actor.id, "CREATED", "encounter", id, `${encounterType} created for ${athlete.firstName} ${athlete.lastName}`);
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
