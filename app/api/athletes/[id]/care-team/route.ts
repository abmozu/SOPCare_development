import { ensureDatabase, writeAudit } from "../../../../../db/runtime";
import { apiError, cleanText, requireApiActor } from "../../../_utils";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireApiActor("clinical.notes.create");
  if (actor instanceof Response) return actor;

  try {
    const { id } = await context.params;
    const payload = await request.json() as Record<string, unknown>;
    const practitionerId = cleanText(payload.practitionerId, 80);
    if (!practitionerId) return Response.json({ error: "Select a practitioner." }, { status: 400 });
    const db = await ensureDatabase();
    await db.prepare("INSERT OR IGNORE INTO athlete_care_team (athlete_id, practitioner_id, is_lead) VALUES (?, ?, 0)")
      .bind(id, practitionerId).run();
    const person = await db.prepare(`SELECT u.full_name AS name FROM practitioner_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.id = ?`)
      .bind(practitionerId).first<{ name: string }>();
    await writeAudit(actor.id, "ASSIGNED", "athlete", id, `${person?.name ?? "Practitioner"} added to the athlete care team`);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
