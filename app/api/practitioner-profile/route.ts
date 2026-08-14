import { ensureDatabase, writeAudit } from "../../../db/runtime";
import { apiError, requireApiActor } from "../_utils";

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
    const { db, profile } = await ensurePractitioner(actor);
    await db.prepare(`UPDATE practitioner_profiles SET specialty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(actor.specialty, profile.id).run();
    await writeAudit(actor.id, "UPDATED", "practitioner_profile", profile.id, "Practitioner profile synchronized");
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
