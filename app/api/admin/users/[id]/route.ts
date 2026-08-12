import { getPortalUser } from "../../../../mock-auth";
import { ensureDatabase, writeAudit } from "../../../../../db/runtime";

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getPortalUser();
  if (!actor?.permissionIds.includes("admin.users.manage")) return Response.json({ error: "You do not have permission to manage users." }, { status: 403 });
  const { id } = await context.params;
  if (id === actor.id) return Response.json({ error: "You cannot delete your own account." }, { status: 400 });
  const db = await ensureDatabase();
  const target = await db.prepare("SELECT username FROM portal_users WHERE id = ?").bind(id).first<{ username: string }>();
  if (!target) return Response.json({ error: "This user cannot be deleted from the administration directory." }, { status: 404 });
  await db.prepare("DELETE FROM portal_users WHERE id = ?").bind(id).run();
  await writeAudit(actor.id, "DELETED", "portal_user", id, `Deleted user ${target.username}`);
  return Response.json({ ok: true });
}
