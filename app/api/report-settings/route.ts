import { getPortalUser } from "../../mock-auth";
import { ensureDatabase, writeAudit } from "../../../db/runtime";

export async function GET() {
  const actor = await getPortalUser();
  if (!actor) return Response.json({ error: "Authentication required." }, { status: 401 });
  const db = await ensureDatabase();
  const row = await db.prepare("SELECT settings_json AS settingsJson FROM report_settings WHERE id = ?").bind("default").first<{ settingsJson: string }>();
  try { return Response.json({ settings: JSON.parse(row?.settingsJson ?? "{}") }); }
  catch { return Response.json({ settings: {} }); }
}

export async function PUT(request: Request) {
  const actor = await getPortalUser();
  if (!actor || !actor.workspaceIds.includes("administration") || !actor.permissionIds.includes("admin.settings.manage")) {
    return Response.json({ error: "You do not have permission to manage report settings." }, { status: 403 });
  }
  const settings = await request.json() as Record<string, unknown>;
  const serialized = JSON.stringify(settings);
  if (serialized.length > 3_200_000) return Response.json({ error: "Report assets are too large." }, { status: 413 });
  const db = await ensureDatabase();
  await db.prepare(`INSERT INTO report_settings (id, settings_json, updated_by, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP::text)
    ON CONFLICT (id) DO UPDATE SET settings_json = excluded.settings_json, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP::text`)
    .bind("default", serialized, actor.id).run();
  await writeAudit(actor.id, "UPDATED", "report_settings", "default", "Updated report branding and layout");
  return Response.json({ settings });
}
