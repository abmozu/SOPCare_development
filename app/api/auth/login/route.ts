import { authenticate, createSessionCookie } from "../../../mock-auth";
import { WORKSPACES } from "../../../access-model";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { username?: string; password?: string };
    const user = await authenticate(body.username ?? "", body.password ?? "");
    if (!user) return Response.json({ error: "Invalid username or password." }, { status: 401 });
    const workspaces = WORKSPACES.filter((workspace) => user.workspaceIds.includes(workspace.id));
    return Response.json({ user, workspaces }, { headers: { "Set-Cookie": await createSessionCookie(user.id) } });
  } catch {
    return Response.json({ error: "Unable to sign in. Please try again." }, { status: 400 });
  }
}
