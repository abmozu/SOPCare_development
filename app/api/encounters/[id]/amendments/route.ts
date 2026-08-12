Exit code: 0
Wall time: 0.6 seconds
Output:
import { ensureDatabase } from "../../../../../db/runtime";
import { apiError, requireApiActor } from "../../../_utils";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireApiActor();
  if (actor instanceof Response) return actor;
  try {
    const { id } = await context.params;
    const db = await ensureDatabase();
    const allowed = await db.prepare(`SELECT e.id FROM encounters e
      JOIN practitioner_profiles pp ON pp.id = e.practitioner_id
      JOIN users u ON u.id = pp.user_id
      WHERE e.id = ? AND (u.id = ? OR u.email = ?) LIMIT 1`).bind(id, actor.id, actor.email).first();
    if (!allowed) return Response.json({ error: "This amendment record is not available." }, { status: 403 });
    const amendments = await db.prepare(`SELECT ea.id, ea.reason, ea.created_at AS createdAt, u.full_name AS practitioner
      FROM encounter_amendments ea
      JOIN practitioner_profiles pp ON pp.id = ea.practitioner_id
      JOIN users u ON u.id = pp.user_id
      WHERE ea.encounter_id = ? ORDER BY ea.created_at DESC, ea.id DESC`).bind(id).all();
    return Response.json({ amendments });
  } catch (error) {
    return apiError(error);
  }
}

