Exit code: 0
Wall time: 0.6 seconds
Output:
import { ensureDatabase, writeAudit } from "../../../db/runtime";
import { apiError, cleanText, requireApiActor } from "../_utils";

function cleanRichHistory(value: unknown) {
  if (typeof value !== "string") return "";
  return value.slice(0, 12000)
    .replace(/<\/?(script|style|iframe|object|embed)[^>]*>/gi, "")
    .replace(/<\/?(?!b\b|strong\b|i\b|em\b|u\b|p\b|br\b|div\b|ul\b|ol\b|li\b|span\b|font\b)[^>]*>/gi, "")
    .replace(/<(b|strong|i|em|u|p|br|div|ul|ol|li)\b[^>]*>/gi, "<$1>")
    .replace(/<(span|font)\b[^>]*>/gi, (tag, element) => {
      const color = tag.match(/\bcolor\s*=\s*["']?(#[0-9a-f]{3,8}|[a-z]+)["']?/i)
        ?? tag.match(/\bstyle\s*=\s*["'][^"']*\bcolor\s*:\s*(#[0-9a-f]{3,8}|[a-z]+)[^"']*["']/i);
      return color ? `<${element} color="${color[1]}">` : `<${element}>`;
    })
    .trim();
}

export async function POST(request: Request) {
  const actor = await requireApiActor("clinical.notes.create");
  if (actor instanceof Response) return actor;

  try {
    const payload = await request.json() as Record<string, unknown>;
    const athleteId = cleanText(payload.athleteId, 80);
    const reason = cleanText(payload.reason, 500);
    const diagnosis = cleanText(payload.diagnosis, 1000);
    const visibility = payload.visibility === "Restricted" ? "Restricted" : "Care team";
    if (!athleteId || !reason || !diagnosis) {
      return Response.json({ error: "Athlete, reason, and free-text diagnosis are required." }, { status: 400 });
    }

    const db = await ensureDatabase();
    const athlete = await db.prepare("SELECT first_name AS firstName, last_name AS lastName FROM athletes WHERE id = ?")
      .bind(athleteId).first<{ firstName: string; lastName: string }>();
    if (!athlete) return Response.json({ error: "Athlete not found." }, { status: 404 });

    let practitioner = await db.prepare(`SELECT pp.id, pp.default_encounter_type AS encounterType, pp.clinic_city AS clinicCity,
      pp.clinic_type AS clinicType, pp.clinic_location AS clinicLocation
      FROM practitioner_profiles pp JOIN users u ON u.id = pp.user_id
      WHERE u.id = ? OR u.email = ? LIMIT 1`).bind(actor.id, actor.email).first<{ id: string; encounterType: string; clinicCity: string; clinicType: string; clinicLocation: string }>();
    if (!practitioner) {
      await db.prepare("INSERT OR IGNORE INTO users (id, email, full_name) VALUES (?, ?, ?)").bind(actor.id, actor.email, actor.name).run();
      const user = await db.prepare("SELECT id FROM users WHERE id = ? OR email = ? LIMIT 1").bind(actor.id, actor.email).first<{ id: string }>();
      if (!user) return Response.json({ error: "The current practitioner account could not be resolved." }, { status: 400 });
      const practitionerId = `pr-${crypto.randomUUID()}`;
      const isPhysio = actor.specialty.includes("Physio");
      const isNutrition = actor.specialty.includes("Nutrition");
      const isPsychology = actor.specialty.includes("Psych");
      const defaults = {
        encounterType: isPhysio ? "Physiotherapy Review" : isNutrition ? "Nutrition Follow-up" : isPsychology ? "Performance Psychology" : "Medical Review",
        clinicCity: isPhysio || isPsychology ? "Dhahran" : "Riyadh",
        clinicType: isPhysio ? "Physiotherapy Clinic" : isNutrition ? "Sports Nutrition Clinic" : isPsychology ? "Sports Psychology Clinic" : "Sports Medicine Clinic",
        clinicLocation: isPhysio || isPsychology ? "SOPCare Dhahran Training Center" : "Riyadh High Performance Center",
      };
      await db.prepare(`INSERT INTO practitioner_profiles (id, user_id, specialty, credentials, default_encounter_type, clinic_city, clinic_type, clinic_location)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(practitionerId, user.id, actor.specialty, "SOPCare practitioner", defaults.encounterType, defaults.clinicCity, defaults.clinicType, defaults.clinicLocation).run();
      practitioner = { id: practitionerId, ...defaults };
    }

    const { encounterType, clinicCity, clinicType, clinicLocation } = practitioner;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.prepare(`INSERT INTO encounters (id, athlete_id, practitioner_id, encounter_date, encounter_type, clinic_city, clinic_type, clinic_location, reason, subjective, objective, assessment, plan, diagnosis, visibility, follow_up_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, athleteId, practitioner.id, now, encounterType, clinicCity, clinicType, clinicLocation, reason, "", "", "", cleanRichHistory(payload.plan), diagnosis, visibility, null)
      .run();
    await writeAudit(actor.id, "CREATED", "encounter", id, `${encounterType} created for ${athlete.firstName} ${athlete.lastName}`);
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

