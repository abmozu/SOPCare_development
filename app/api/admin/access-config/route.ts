import { PERMISSIONS } from "../../../access-model";
import { configuredAccessRoles, directoryUsers, getPortalUser } from "../../../mock-auth";
import { ensureDatabase, writeAudit } from "../../../../db/runtime";

function text(value: unknown, max = 180) {
  return String(value ?? "").trim().slice(0, max);
}

function permissionIds(value: unknown) {
  const allowed = new Set(PERMISSIONS.map((permission) => permission.id));
  return Array.isArray(value) ? Array.from(new Set(value.filter((id): id is string => typeof id === "string" && allowed.has(id)))) : [];
}

async function requireAdmin(permission: string) {
  const actor = await getPortalUser();
  if (!actor || !actor.workspaceIds.includes("administration") || !actor.permissionIds.includes(permission)) {
    return Response.json({ error: "You do not have permission to manage access configuration." }, { status: 403 });
  }
  return actor;
}

export async function POST(request: Request) {
  const body = await request.json() as Record<string, unknown>;
  const kind = body.kind === "professional_role" ? "professional_role" : "access_role";
  const actor = await requireAdmin(kind === "professional_role" ? "admin.professional_roles.manage" : "admin.permissions.manage");
  if (actor instanceof Response) return actor;
  const name = text(body.name, 100);
  const description = text(body.description, 500);
  if (!name) return Response.json({ error: "A name is required." }, { status: 400 });
  const db = await ensureDatabase();
  const id = crypto.randomUUID();
  try {
    if (kind === "professional_role") {
      await db.prepare("INSERT INTO professional_role_configs (id, name, description, active) VALUES (?, ?, ?, ?)").bind(id, name, description, body.active === false ? 0 : 1).run();
    } else {
      await db.prepare("INSERT INTO access_role_configs (id, name, description, permission_ids) VALUES (?, ?, ?, ?)").bind(id, name, description, JSON.stringify(permissionIds(body.permissionIds))).run();
    }
    await writeAudit(actor.id, "CREATED", kind, id, `Created ${name}`);
    return Response.json({ id }, { status: 201 });
  } catch {
    return Response.json({ error: "A record with this name already exists." }, { status: 409 });
  }
}

export async function PATCH(request: Request) {
  const body = await request.json() as Record<string, unknown>;
  const kind = text(body.kind, 40);
  const id = text(body.id, 100);
  if (!id) return Response.json({ error: "A record is required." }, { status: 400 });
  if (kind === "user_override") {
    const actor = await requireAdmin("admin.permissions.manage");
    if (actor instanceof Response) return actor;
    const users = await directoryUsers();
    const user = users.find((item) => item.id === id);
    if (!user) return Response.json({ error: "User not found." }, { status: 404 });
    const selected = permissionIds(body.permissionIds);
    const roles = await configuredAccessRoles();
    const base = Array.from(new Set(user.roleIds.flatMap((roleId) => roles.find((role) => role.id === roleId)?.permissionIds ?? [])));
    const grant = selected.filter((permission) => !base.includes(permission));
    const revoke = base.filter((permission) => !selected.includes(permission));
    const db = await ensureDatabase();
    const stored = await db.prepare("SELECT id FROM portal_users WHERE id = ?").bind(id).first<{ id: string }>();
    if (stored) {
      await db.prepare("UPDATE portal_users SET permission_overrides = ?, updated_at = CURRENT_TIMESTAMP::text WHERE id = ?").bind(JSON.stringify({ grant, revoke }), id).run();
    } else {
      await db.prepare(`INSERT INTO user_directory_overrides (user_id, professional_role_id, professional_role, clinic_city, phone_number, job_title, department, status, workspace_ids, role_ids, permission_overrides)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET permission_overrides = excluded.permission_overrides, updated_at = CURRENT_TIMESTAMP::text`)
        .bind(id, user.professionalRoleId, user.professionalRole, user.clinicCity, user.phoneNumber, user.jobTitle, user.department, user.status, JSON.stringify(user.workspaceIds), JSON.stringify(user.roleIds), JSON.stringify({ grant, revoke })).run();
    }
    await writeAudit(actor.id, "UPDATED", "user_permissions", id, `Updated access exceptions for ${user.username}`);
    return Response.json({ ok: true });
  }

  const professional = kind === "professional_role";
  const actor = await requireAdmin(professional ? "admin.professional_roles.manage" : "admin.permissions.manage");
  if (actor instanceof Response) return actor;
  const db = await ensureDatabase();
  if (professional) {
    const name = text(body.name, 100);
    if (!name) return Response.json({ error: "A professional role name is required." }, { status: 400 });
    await db.prepare("UPDATE professional_role_configs SET name = ?, description = ?, active = ?, updated_at = CURRENT_TIMESTAMP::text WHERE id = ?").bind(name, text(body.description, 500), body.active === false ? 0 : 1, id).run();
    await writeAudit(actor.id, "UPDATED", "professional_role", id, `Updated ${name}`);
  } else {
    const selected = permissionIds(body.permissionIds);
    if (id === "role-admin" && (!selected.includes("admin.users.manage") || !selected.includes("admin.permissions.manage"))) {
      return Response.json({ error: "System Administrator must retain user and permission management access." }, { status: 400 });
    }
    await db.prepare("UPDATE access_role_configs SET permission_ids = ?, updated_at = CURRENT_TIMESTAMP::text WHERE id = ?").bind(JSON.stringify(selected), id).run();
    await writeAudit(actor.id, "UPDATED", "access_role", id, "Updated role permissions");
  }
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = await request.json() as Record<string, unknown>;
  const kind = body.kind === "professional_role" ? "professional_role" : "access_role";
  const id = text(body.id, 100);
  const actor = await requireAdmin(kind === "professional_role" ? "admin.professional_roles.manage" : "admin.permissions.manage");
  if (actor instanceof Response) return actor;
  if (["role-admin", "role-clinician", "role-readonly"].includes(id)) return Response.json({ error: "Built-in access roles cannot be deleted." }, { status: 400 });
  const users = await directoryUsers();
  const assigned = kind === "professional_role" ? users.some((user) => user.professionalRoleId === id) : users.some((user) => user.roleIds.includes(id));
  if (assigned) return Response.json({ error: "This role is assigned to a user and cannot be deleted." }, { status: 409 });
  const db = await ensureDatabase();
  await db.prepare(kind === "professional_role" ? "DELETE FROM professional_role_configs WHERE id = ?" : "DELETE FROM access_role_configs WHERE id = ?").bind(id).run();
  await writeAudit(actor.id, "DELETED", kind, id, "Deleted unassigned role");
  return Response.json({ ok: true });
}
