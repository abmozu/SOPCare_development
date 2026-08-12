import { ensureDatabase, writeAudit } from "../../../../db/runtime";
import { apiError, cleanText, requireApiActor } from "../../_utils";

const editableFields = {
  subjective: "subjective",
  objective: "objective",
  assessment: "assessment",
  plan: "plan",
  diagnosis: "diagnosis",
} as const;

function cleanRichText(value: unknown, max = 12000) {
  if (typeof value !== "string") return "";
  return value.slice(0, max)
    .replace(/<\/?(script|style|iframe|object|embed)[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*(["']).*?\1/gi, "")
    .replace(/\sstyle\s*=\s*(["']).*?expression.*?\1/gi, "")
    .trim();
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireApiActor("clinical.notes.edit");
  if (actor instanceof Response) return actor;

  try {
    const { id } = await context.params;
    const payload = await request.json() as Record<string, unknown>;
    const amendmentReason = cleanText(payload.amendmentReason, 500);
    const entries = Object.entries(editableFields)
      .filter(([field]) => Object.prototype.hasOwnProperty.call(payload, field))
      .map(([field, column]) => ({ field, column, value: field === "plan" ? cleanRichText(payload[field]) : cleanText(payload[field], field === "diagnosis" ? 1000 : 4000) }));
    if (!entries.length) return Response.json({ error: "No editable visit fields were supplied." }, { status: 400 });

    const db = await ensureDatabase();
    const encounter = await db.prepare(`SELECT e.id, pp.id AS practitionerId FROM encounters e
      JOIN practitioner_profiles pp ON pp.id = e.practitioner_id
      JOIN users u ON u.id = pp.user_id
      WHERE e.id = ? AND (u.id = ? OR u.email = ?) LIMIT 1`)
      .bind(id, actor.id, actor.email).first<{ id: string; practitionerId: string }>();
    if (!encounter) return Response.json({ error: "You can edit only visits recorded from your practitioner account." }, { status: 403 });

    const assignments = entries.map((entry) => `${entry.column} = ?`).join(", ");
    await db.prepare(`UPDATE encounters SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(...entries.map((entry) => entry.value), id).run();
    await db.prepare("INSERT INTO encounter_amendments (id, encounter_id, practitioner_id, reason, content) VALUES (?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), id, encounter.practitionerId, amendmentReason || "Clinical history amended", JSON.stringify({ fields: entries.map((entry) => entry.field), content: entries.find((entry) => entry.field === "plan")?.value ?? "" }))
      .run();
    await writeAudit(actor.id, "UPDATED", "encounter", id, `Visit amendment saved: ${entries.map((entry) => entry.field).join(", ")}${amendmentReason ? ` · Reason: ${amendmentReason}` : ""}`);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
