import { PROFESSIONAL_ROLES, publicUser, type PortalUser } from "../../../access-model";
import { hashPassword, getPortalUser } from "../../../mock-auth";
import { ensureDatabase, writeAudit } from "../../../../db/runtime";

function array(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function POST(request: Request) {
  const actor = await getPortalUser();
  if (!actor?.permissionIds.includes("admin.users.manage")) return Response.json({ error: "You do not have permission to manage users." }, { status: 403 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const fullName = String(body.fullName ?? "").trim();
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const email = String(body.email ?? "").trim().toLowerCase();
    const professionalRoleId = String(body.professionalRoleId ?? "");
    const professionalRole = PROFESSIONAL_ROLES.find((role) => role.id === professionalRoleId);
    const workspaceIds = array(body.workspaceIds).filter((id) => id === "administration" || id === "healthcare");
    if (!fullName || !/^[a-z0-9._-]{3,80}$/i.test(username) || password.length < 6 || !/^\S+@\S+\.\S+$/.test(email) || !professionalRole || workspaceIds.length === 0) {
      return Response.json({ error: "Complete all required user details. Passwords must contain at least 6 characters." }, { status: 400 });
    }
    const db = await ensureDatabase();
    const existing = await db.prepare("SELECT id FROM portal_users WHERE username = ? OR email = ? LIMIT 1").bind(username, email).first<{ id: string }>();
    const id = existing?.id ?? crypto.randomUUID();
    const user: PortalUser = {
      id, fullName, username, email,
      phoneNumber: String(body.phoneNumber ?? "").trim(),
      professionalRoleId, professionalRole: professionalRole.name,
      jobTitle: String(body.jobTitle ?? "").trim(), department: String(body.department ?? "").trim(),
      status: body.status === "Inactive" ? "Inactive" : "Active", workspaceIds,
      roleIds: ["role-clinician"], permissionIds: professionalRole.defaultPermissionIds,
      permissionOverrides: { grant: [], revoke: [] }, lastActive: new Date().toISOString(),
    };
    if (existing) {
      await db.prepare(`UPDATE portal_users SET username = ?, password_hash = ?, email = ?, full_name = ?, phone_number = ?, professional_role_id = ?, professional_role = ?, job_title = ?, department = ?, status = ?, workspace_ids = ?, role_ids = ?, permission_ids = ?, permission_overrides = ?, last_active = ?, updated_at = CURRENT_TIMESTAMP::text WHERE id = ?`)
        .bind(user.username, await hashPassword(password), user.email, user.fullName, user.phoneNumber, user.professionalRoleId, user.professionalRole, user.jobTitle, user.department, user.status, JSON.stringify(user.workspaceIds), JSON.stringify(user.roleIds), JSON.stringify(user.permissionIds), JSON.stringify(user.permissionOverrides), user.lastActive, id).run();
      await writeAudit(actor.id, "RESTORED", "portal_user", id, `Restored user ${username}`);
      return Response.json({ user: publicUser(user), restored: true });
    }
    await db.prepare(`INSERT INTO portal_users (id, username, password_hash, email, full_name, phone_number, professional_role_id, professional_role, job_title, department, status, workspace_ids, role_ids, permission_ids, permission_overrides, last_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, user.username, await hashPassword(password), user.email, user.fullName, user.phoneNumber, user.professionalRoleId, user.professionalRole, user.jobTitle, user.department, user.status, JSON.stringify(user.workspaceIds), JSON.stringify(user.roleIds), JSON.stringify(user.permissionIds), JSON.stringify(user.permissionOverrides), user.lastActive).run();
    await writeAudit(actor.id, "CREATED", "portal_user", id, `Created user ${username}`);
    return Response.json({ user: publicUser(user) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && /unique/i.test(error.message) ? "Username or email already exists." : "Unable to save the user.";
    return Response.json({ error: message }, { status: 400 });
  }
}
