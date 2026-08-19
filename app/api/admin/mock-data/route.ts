import { PERMISSIONS, WORKSPACES, publicUser } from "../../../access-model";
import { configuredAccessRoles, configuredProfessionalRoles, directoryUsers, getPortalUser } from "../../../mock-auth";
import { ensureDatabase } from "../../../../db/runtime";

export async function GET() {
  const actor = await getPortalUser();
  if (!actor || !actor.workspaceIds.includes("administration")) {
    return Response.json({ error: "You do not have permission to access this page." }, { status: 403 });
  }
  const db = await ensureDatabase();
  const [athletes, sports, teams, storedUsers, configuredRoles, professionalRoles, auditRows] = await Promise.all([
    db.prepare(`SELECT a.id, a.mrn, a.first_name AS firstName, a.last_name AS lastName,
      a.date_of_birth AS dateOfBirth, a.sex, a.sport_id AS sportId, a.discipline,
      a.dominant_side AS dominantSide, a.status, s.name AS sport,
      atm.team_id AS teamId, COALESCE(t.name, 'Unassigned') AS team
      FROM athletes a JOIN sports s ON s.id = a.sport_id
      LEFT JOIN athlete_team_memberships atm ON atm.athlete_id = a.id AND atm.is_primary = 1
      LEFT JOIN teams t ON t.id = atm.team_id
      ORDER BY a.updated_at DESC, a.last_name ASC`).all(),
    db.prepare("SELECT id, name FROM sports ORDER BY name").all(),
    db.prepare("SELECT id, name FROM teams ORDER BY name").all(),
    directoryUsers(),
    configuredAccessRoles(),
    configuredProfessionalRoles(),
    db.prepare("SELECT id, actor_id AS actorId, action, summary AS target, created_at AS createdAt FROM audit_logs ORDER BY created_at DESC, id DESC LIMIT 100").all<{ id: string; actorId: string; action: string; target: string; createdAt: string }>(),
  ]);
  const roles = configuredRoles.map((role) => ({ ...role, userCount: storedUsers.filter((user) => user.roleIds.includes(role.id)).length }));
  const auditLogs = auditRows.results.map((entry) => ({ id: entry.id, username: storedUsers.find((user) => user.id === entry.actorId)?.username ?? "system", action: entry.action, target: entry.target, createdAt: entry.createdAt }));
  return Response.json({
    users: storedUsers.map(publicUser),
    workspaces: WORKSPACES,
    permissions: PERMISSIONS,
    professionalRoles,
    roles,
    auditLogs,
    athletes: athletes.results,
    sports: sports.results,
    teams: teams.results,
  });
}
