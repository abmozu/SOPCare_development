import { getPortalUser } from "../../../../mock-auth";
import { ensureDatabase, writeAudit } from "../../../../../db/runtime";
import { PROFESSIONAL_ROLES, type PortalUser } from "../../../../access-model";

const cities = ["Riyadh", "Jeddah", "Dammam"] as const;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getPortalUser();
  if (!actor?.permissionIds.includes("admin.users.manage")) return Response.json({ error: "You do not have permission to manage users." }, { status: 403 });
  const { id } = await context.params;
  try {
    const body = await request.json() as Record<string, unknown>;
    const professionalRoleId = String(body.professionalRoleId ?? "");
    const role = PROFESSIONAL_ROLES.find((item) => item.id === professionalRoleId);
    const clinicCity = String(body.clinicCity ?? "") as PortalUser["clinicCity"];
    const jobTitle = String(body.jobTitle ?? "").trim();
    const department = String(body.department ?? "").trim();
    const status = body.status === "Inactive" ? "Inactive" : "Active";
    const workspaceIds = Array.isArray(body.workspaceIds) ? body.workspaceIds.filter((item): item is string => item === "administration" || item === "healthcare") : [];
    if (!role || !cities.includes(clinicCity) || workspaceIds.length === 0) return Response.json({ error: "Select a professional role, city, and workspace access." }, { status: 400 });
    const db = await ensureDatabase();
    const stored = await db.prepare("SELECT id FROM portal_users WHERE id = ?").bind(id).first<{ id: string }>();
    if (stored) {
      await db.prepare("UPDATE portal_users SET professional_role_id = ?, professional_role = ?, clinic_city = ?, job_title = ?, department = ?, status = ?, workspace_ids = ?, updated_at = CURRENT_TIMESTAMP::text WHERE id = ?")
        .bind(role.id, role.name, clinicCity, jobTitle, department, status, JSON.stringify(workspaceIds), id).run();
    } else {
      await db.prepare(`INSERT INTO user_directory_overrides (user_id, professional_role_id, professional_role, clinic_city, job_title, department, status, workspace_ids)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET professional_role_id = excluded.professional_role_id, professional_role = excluded.professional_role, clinic_city = excluded.clinic_city, job_title = excluded.job_title, department = excluded.department, status = excluded.status, workspace_ids = excluded.workspace_ids, updated_at = CURRENT_TIMESTAMP::text`)
        .bind(id, role.id, role.name, clinicCity, jobTitle, department, status, JSON.stringify(workspaceIds)).run();
    }
    await writeAudit(actor.id, "UPDATED", "portal_user", id, `Updated practitioner directory details`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Unable to update the user." }, { status: 400 });
  }
}

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
