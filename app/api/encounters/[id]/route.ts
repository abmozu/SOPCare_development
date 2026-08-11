import { ensureDatabase, writeAudit } from "../../../../db/runtime";
import { apiError, cleanText, requireApiActor } from "../../_utils";

const editableFields = {
  subjective: "subjective",
  objective: "objective",
  assessment: "assessment",
  plan: "plan",
  diagnosis: "diagnosis",
} as const;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireApiActor("clinical.notes.edit");
  if (actor instanceof Response) return actor;

  try {
    const { id } = await context.params;
    const payload = await request.json() as Record<string, unknown>;
    const amendmentReason = cleanText(payload.amendmentReason, 500);
    const entries = Object.entries(editableFields)
      .filter(([field]) => Object.prototype.hasOwnProperty.call(payload, field))
      .map(([field, column]) => ({ field, column, value: cleanText(payload[field], field === "diagnosis" ? 1000 : 4000) }));
    if (!entries.length) return Response.json({ error: "No editable visit fields were supplied." }, { status: 400 });

    const db = await ensureDatabase();
    const encounter = await db.prepare(`SELECT e.id FROM encounters e
      JOIN practitioner_profiles pp ON pp.id = e.practitioner_id
      JOIN users u ON u.id = pp.user_id
      WHERE e.id = ? AND (u.id = ? OR u.email = ?) LIMIT 1`)
      .bind(id, actor.id, actor.email).first<{ id: string }>();
    if (!encounter) return Response.json({ error: "You can edit only visits recorded from your practitioner account." }, { status: 403 });

    const assignments = entries.map((entry) => `${entry.column} = ?`).join(", ");
    await db.prepare(`UPDATE encounters SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(...entries.map((entry) => entry.value), id).run();
    await writeAudit(actor.id, "UPDATED", "encounter", id, `Visit amendment saved: ${entries.map((entry) => entry.field).join(", ")}${amendmentReason ? ` · Reason: ${amendmentReason}` : ""}`);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
