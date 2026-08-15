import { ensureDatabase, writeAudit } from "../../../../../db/runtime";
import { apiError, requireApiActor, requireClinicalWriteRole } from "../../../_utils";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireApiActor("clinical.notes.create"); if (actor instanceof Response) return actor;
  const forbidden = requireClinicalWriteRole(actor); if (forbidden) return forbidden;
  try {
    const { id } = await context.params; const db = await ensureDatabase();
    const handover = await db.prepare("SELECT injury_id AS injuryId, plan_id AS planId, status FROM clinical_handovers WHERE id = ? AND to_user_id = ?").bind(id, actor.id).first<{ injuryId: string; planId: string | null; status: string }>();
    if (!handover || handover.status !== "Pending") return Response.json({ error: "This handover is no longer available." }, { status: 404 });
    const practitioner = await db.prepare("SELECT id FROM practitioner_profiles WHERE user_id = ?").bind(actor.id).first<{ id: string }>();
    if (!practitioner) return Response.json({ error: "Your practitioner profile is unavailable." }, { status: 400 });
    const now = new Date().toISOString();
    await db.batch([
      db.prepare("UPDATE clinical_handovers SET status = 'Accepted', accepted_at = ? WHERE id = ?").bind(now, id),
      db.prepare("UPDATE clinical_tasks SET status = 'Completed', completed_at = ? WHERE handover_id = ? AND recipient_user_id = ?").bind(now, id, actor.id),
      db.prepare("UPDATE injury_episodes SET lead_practitioner_id = ?, updated_at = ? WHERE id = ?").bind(practitioner.id, now, handover.injuryId),
      ...(handover.planId ? [db.prepare("UPDATE rehabilitation_plans SET owner_practitioner_id = ?, updated_at = ? WHERE id = ?").bind(practitioner.id, now, handover.planId)] : []),
    ]);
    await writeAudit(actor.id, "CARE_HANDOVER_ACCEPTED", "injury_episode", handover.injuryId, "Care handover accepted");
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
