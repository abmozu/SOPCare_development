import { WORKSPACES } from "../../../access-model";
import { getPortalUser } from "../../../mock-auth";

export async function GET() {
  const user = await getPortalUser();
  if (!user) return Response.json({ authenticated: false }, { status: 401 });
  return Response.json({ authenticated: true, user, workspaces: WORKSPACES.filter((workspace) => user.workspaceIds.includes(workspace.id)) });
}
