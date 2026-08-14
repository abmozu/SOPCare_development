import { getPortalUser } from "../mock-auth";

export type ApiActor = { id: string; name: string; email: string; specialty: string; clinicCity: string; permissions: string[]; workspaceIds: string[] };

export async function requireApiActor(permission = "clinical.records.view"): Promise<ApiActor | Response> {
  const user = await getPortalUser();
  if (user) {
    if (!user.workspaceIds.includes("healthcare") || !user.permissionIds.includes(permission)) {
      return Response.json({ error: "You do not have permission to access this page." }, { status: 403 });
    }
    return {
      id: user.id,
      name: user.fullName,
      email: user.email,
      specialty: user.professionalRole,
      clinicCity: user.clinicCity,
      permissions: user.permissionIds,
      workspaceIds: user.workspaceIds,
    };
  }
  return Response.json({ error: "Authentication required." }, { status: 401 });
}

export function apiError(error: unknown) {
  console.error(error);
  return Response.json(
    { error: "SOPCare could not complete this request. Please try again." },
    { status: 500 },
  );
}

export function cleanText(value: unknown, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function requireClinicalWriteRole(actor: ApiActor) {
  return actor.permissions.includes("clinical.notes.create")
    ? null
    : Response.json({ error: "You do not have permission to access this page." }, { status: 403 });
}
