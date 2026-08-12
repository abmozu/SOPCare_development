import { ensureDatabase, writeAudit } from "../../../db/runtime";
import { apiError, cleanText, requireApiActor } from "../_utils";

const encounterTypes = ["Medical Review", "Physiotherapy Review", "Nutrition Follow-up", "Performance Psychology", "Return-to-Sport Review", "Medical Screening"];
const clinicCities = ["Riyadh", "Dammam", "Dhahran"];
const clinicTypes = ["Sports Medicine Clinic", "Physiotherapy Clinic", "Sports Nutrition Clinic", "Sports Psychology Clinic", "Performance & Recovery Clinic"];

function specialtyDefaults(specialty: string) {
  if (specialty.includes("Physio")) return { encounterType: "Physiotherapy Review", clinicCity: "Dhahran", clinicType: "Physiotherapy Clinic", clinicLocation: "SOPCare Dhahran Training Center" };
  if (specialty.includes("Nutrition")) return { encounterType: "Nutrition Follow-up", clinicCity: "Riyadh", clinicType: "Sports Nutrition Clinic", clinicLocation: "Riyadh High Performance Center" };
  if (specialty.includes("Psych")) return { encounterType: "Performance Psychology", clinicCity: "Dhahran", clinicType: "Sports Psychology Clinic", clinicLocation: "SOPCare Dhahran Training Center" };
  return { encounterType: "Medical Review", clinicCity: "Riyadh", clinicType: "Sports Medicine Clinic", clinicLocation: "Riyadh High Performance Center" };
}

async function ensurePractitioner(actor: Exclude<Awaited<ReturnType<typeof requireApiActor>>, Response>) {
  const db = await ensureDatabase();
  await db.prepare("INSERT OR IGNORE INTO users (id, email, full_name) VALUES (?, ?, ?)").bind(actor.id, actor.email, actor.name).run();
  let profile = await db.prepare("SELECT id FROM practitioner_profiles WHERE user_id = ? LIMIT 1").bind(actor.id).first<{ id: string }>();
  if (!profile) {
    const defaults = specialtyDefaults(actor.specialty);
    profile = { id: `pr-${crypto.randomUUID()}` };
    await db.prepare(`INSERT INTO practitioner_profiles (id, user_id, specialty, credentials, default_encounter_type, clinic_city, clinic_type, clinic_location)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(profile.id, actor.id, actor.specialty, "SOPCare practitioner", defaults.encounterType, defaults.clinicCity, defaults.clinicType, defaults.clinicLocation).run();
  }
  return { db, profile };
}

export async function PATCH(request: Request) {
  const actor = await requireApiActor("clinical.notes.create");
  if (actor instanceof Response) return actor;
  try {
    const payload = await request.json() as Record<string, unknown>;
    const defaultEncounterType = cleanText(payload.defaultEncounterType, 100);
    const clinicCity = cleanText(payload.clinicCity, 40);
    const clinicType = cleanText(payload.clinicType, 100);
    const clinicLocation = cleanText(payload.clinicLocation, 160);
    if (!encounterTypes.includes(defaultEncounterType) || !clinicCities.includes(clinicCity) || !clinicTypes.includes(clinicType) || !clinicLocation) {
      return Response.json({ error: "Complete the practitioner clinic settings." }, { status: 400 });
    }
    const { db, profile } = await ensurePractitioner(actor);
    await db.prepare(`UPDATE practitioner_profiles SET default_encounter_type = ?, clinic_city = ?, clinic_type = ?, clinic_location = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(defaultEncounterType, clinicCity, clinicType, clinicLocation, profile.id).run();
    await writeAudit(actor.id, "UPDATED", "practitioner_profile", profile.id, "Practitioner clinic defaults updated");
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
