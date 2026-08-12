import { ensureDatabase, writeAudit } from "../../../../db/runtime";
import { apiError, cleanText, requireApiActor } from "../../_utils";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireApiActor("athletes.edit");
  if (actor instanceof Response) return actor;

  try {
    const { id } = await context.params;
    const payload = await request.json() as Record<string, unknown>;
    const safetyCategory = cleanText(payload.safetyCategory, 40);
    const safetyColumns: Record<string, string> = {
      allergies: "allergies",
      chronicConditions: "chronic_conditions",
      prohibitedMedications: "prohibited_medications",
    };
    if (safetyCategory) {
      const column = safetyColumns[safetyCategory];
      if (!column) return Response.json({ error: "Select a valid clinical safety category." }, { status: 400 });
      const value = cleanText(payload.value, 1000) || "None recorded";
      const db = await ensureDatabase();
      const result = await db.prepare(`UPDATE athletes SET ${column} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(value, id).run();
      if (!result.meta.changes) return Response.json({ error: "Athlete not found." }, { status: 404 });
      await writeAudit(actor.id, "UPDATED", "athlete", id, `Updated athlete ${safetyCategory}`);
      return Response.json({ ok: true });
    }
    const status = cleanText(payload.status, 40);
    const medicalAlerts = cleanText(payload.medicalAlerts, 500);
    const emergencyContact = cleanText(payload.emergencyContact, 200);
    const followUpDate = cleanText(payload.followUpDate, 10) || null;
    const allowedStatuses = ["Available", "Modified Training", "Under Treatment", "Return-to-Sport Review", "Temporarily Unavailable"];
    if (!allowedStatuses.includes(status)) {
      return Response.json({ error: "Select a valid clinical status." }, { status: 400 });
    }

    const db = await ensureDatabase();
    const result = await db.prepare(`UPDATE athletes SET status = ?, medical_alerts = ?, emergency_contact = ?, follow_up_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(status, medicalAlerts || "None recorded", emergencyContact || "Not provided", followUpDate, id)
      .run();
    if (!result.meta.changes) return Response.json({ error: "Athlete not found." }, { status: 404 });
    await writeAudit(actor.id, "UPDATED", "athlete", id, "Athlete profile and clinical status updated");
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
