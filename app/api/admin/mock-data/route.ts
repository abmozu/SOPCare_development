import { ACCESS_ROLES, MOCK_AUDIT_LOGS, MOCK_USERS, PERMISSIONS, PROFESSIONAL_ROLES, WORKSPACES, publicUser } from "../../../access-model";
import { getPortalUser, storedPortalUsers } from "../../../mock-auth";
import { ensureDatabase } from "../../../../db/runtime";

export async function GET() {
  const actor = await getPortalUser();
  if (!actor || !actor.workspaceIds.includes("administration")) {
    return Response.json({ error: "You do not have permission to access this page." }, { status: 403 });
  }
  const db = await ensureDatabase();
  const [athletes, sports, teams, storedUsers] = await Promise.all([
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
    storedPortalUsers(),
  ]);
  return Response.json({
    users: [...storedUsers.map(publicUser), ...MOCK_USERS.map(publicUser)],
    workspaces: WORKSPACES,
    permissions: PERMISSIONS,
    professionalRoles: PROFESSIONAL_ROLES,
    roles: ACCESS_ROLES,
    auditLogs: MOCK_AUDIT_LOGS,
    athletes: athletes.results,
    sports: sports.results,
    teams: teams.results,
  });
}
