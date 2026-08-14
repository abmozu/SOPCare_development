import { ensureDatabase, writeAudit } from "../../../db/runtime";
import { apiError, cleanText, requireApiActor } from "../_utils";

async function ensurePractitioner(actor: Exclude<Awaited<ReturnType<typeof requireApiActor>>, Response>) {
  const db = await ensureDatabase();
  await db.prepare("INSERT OR IGNORE INTO users (id, email, full_name) VALUES (?, ?, ?)").bind(actor.id, actor.email, actor.name).run();
  let profile = await db.prepare("SELECT id FROM practitioner_profiles WHERE user_id = ? LIMIT 1").bind(actor.id).first<{ id: string }>();
  if (!profile) {
    profile = { id: `pr-${crypto.randomUUID()}` };
    await db.prepare(`INSERT INTO practitioner_profiles (id, user_id, specialty, credentials)
      VALUES (?, ?, ?, ?)`).bind(profile.id, actor.id, actor.specialty, "SOPCare practitioner").run();
  }
  return { db, profile };
}

export async function PATCH(request: Request) {
  const actor = await requireApiActor("clinical.notes.create");
  if (actor instanceof Response) return actor;
  try {
    const payload = await request.json() as Record<string, unknown>;
    const phoneNumber = cleanText(payload.phoneNumber, 40);
    const { db, profile } = await ensurePractitioner(actor);
    await db.prepare(`UPDATE practitioner_profiles SET specialty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(actor.specialty, profile.id).run();
    const stored = await db.prepare("SELECT id FROM portal_users WHERE id = ?").bind(actor.id).first<{ id: string }>();
    if (stored) {
      await db.prepare("UPDATE portal_users SET phone_number = ?, updated_at = CURRENT_TIMESTAMP::text WHERE id = ?").bind(phoneNumber, actor.id).run();
    } else {
      await db.prepare(`INSERT INTO user_directory_overrides (user_id, professional_role_id, professional_role, clinic_city, phone_number, job_title, department, status, workspace_ids)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', '[\"healthcare\"]')
        ON CONFLICT(user_id) DO UPDATE SET phone_number = excluded.phone_number, updated_at = CURRENT_TIMESTAMP::text`)
        .bind(actor.id, actor.specialty, actor.specialty, actor.clinicCity, phoneNumber, actor.jobTitle, "").run();
    }
    await writeAudit(actor.id, "UPDATED", "practitioner_profile", profile.id, "Practitioner profile synchronized");
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
