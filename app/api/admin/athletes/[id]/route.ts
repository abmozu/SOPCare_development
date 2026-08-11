import { ensureDatabase, writeAudit } from "../../../../../db/runtime";
import { cleanText, apiError } from "../../../_utils";
import { getPortalUser } from "../../../../mock-auth";

async function requireAdmin(permission: string) {
  const actor = await getPortalUser();
  if (!actor || !actor.workspaceIds.includes("administration") || !actor.permissionIds.includes(permission)) {
    return Response.json({ error: "You do not have permission to access this page." }, { status: 403 });
  }
  return actor;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin("athletes.edit");
  if (actor instanceof Response) return actor;
  try {
    const { id } = await context.params;
    const payload = await request.json() as Record<string, unknown>;
    const db = await ensureDatabase();
    if (payload.mode === "status") {
      const status = payload.active === false ? "Temporarily Unavailable" : "Available";
      const result = await db.prepare("UPDATE athletes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(status, id).run();
      if (!result.meta.changes) return Response.json({ error: "Athlete not found." }, { status: 404 });
      await writeAudit(actor.id, "UPDATED", "athlete", id, payload.active === false ? "Athlete deactivated" : "Athlete activated");
      return Response.json({ ok: true });
    }
    const firstName = cleanText(payload.firstName, 80); const lastName = cleanText(payload.lastName, 80);
    const dateOfBirth = cleanText(payload.dateOfBirth, 10); const sex = cleanText(payload.sex, 20);
    const sportId = cleanText(payload.sportId, 80); const discipline = cleanText(payload.discipline, 100);
    const teamId = cleanText(payload.teamId, 80); const dominantSide = cleanText(payload.dominantSide, 20) || "Right";
    if (!firstName || !lastName || !dateOfBirth || !sex || !sportId || !discipline || !teamId) return Response.json({ error: "Complete all required athlete fields." }, { status: 400 });
    await db.batch([
      db.prepare("UPDATE athletes SET first_name = ?, last_name = ?, date_of_birth = ?, sex = ?, sport_id = ?, discipline = ?, dominant_side = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(firstName, lastName, dateOfBirth, sex, sportId, discipline, dominantSide, id),
      db.prepare("DELETE FROM athlete_team_memberships WHERE athlete_id = ?").bind(id),
      db.prepare("INSERT INTO athlete_team_memberships (athlete_id, team_id, is_primary) VALUES (?, ?, 1)").bind(id, teamId),
    ]);
    await writeAudit(actor.id, "UPDATED", "athlete", id, `Athlete profile updated for ${firstName} ${lastName}`);
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin("athletes.delete");
  if (actor instanceof Response) return actor;
  try {
    const { id } = await context.params; const db = await ensureDatabase();
    const linked = await db.prepare(`SELECT
      (SELECT COUNT(*) FROM encounters WHERE athlete_id = ?) +
      (SELECT COUNT(*) FROM injury_episodes WHERE athlete_id = ?) +
      (SELECT COUNT(*) FROM rehabilitation_plans WHERE athlete_id = ?) AS count`).bind(id, id, id).first<{ count: number }>();
    if ((linked?.count ?? 0) > 0) return Response.json({ error: "This athlete has clinical records and cannot be deleted. Deactivate the athlete instead." }, { status: 409 });
    await db.batch([
      db.prepare("DELETE FROM athlete_care_team WHERE athlete_id = ?").bind(id),
      db.prepare("DELETE FROM athlete_team_memberships WHERE athlete_id = ?").bind(id),
      db.prepare("DELETE FROM athletes WHERE id = ?").bind(id),
    ]);
    await writeAudit(actor.id, "DELETED", "athlete", id, "Athlete profile deleted");
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
