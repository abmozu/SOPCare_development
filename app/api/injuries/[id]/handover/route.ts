import { ensureDatabase, writeAudit } from "../../../../../db/runtime";
import { apiError, cleanText, requireApiActor, requireClinicalWriteRole } from "../../../_utils";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireApiActor("clinical.notes.create");
  if (actor instanceof Response) return actor;
  const forbidden = requireClinicalWriteRole(actor); if (forbidden) return forbidden;
  try {
    const { id } = await context.params; const payload = await request.json() as Record<string, unknown>;
    const toUserId = cleanText(payload.toUserId, 100); const summary = cleanText(payload.summary, 1600);
    if (!toUserId || !summary || toUserId === actor.id) return Response.json({ error: "Choose another practitioner and provide a clinical handover summary." }, { status: 400 });
    const db = await ensureDatabase();
    const injury = await db.prepare("SELECT title FROM injury_episodes WHERE id = ? AND stage <> 'Closed'").bind(id).first<{ title: string }>();
    const recipient = await db.prepare("SELECT id, full_name AS name FROM users WHERE id = ?").bind(toUserId).first<{ id: string; name: string }>();
    if (!injury || !recipient) return Response.json({ error: "The injury or receiving practitioner is unavailable." }, { status: 404 });
    const plan = await db.prepare("SELECT id FROM rehabilitation_plans WHERE injury_id = ? AND status IN ('Active', 'Awaiting medical clearance') ORDER BY updated_at DESC LIMIT 1").bind(id).first<{ id: string }>();
    const now = new Date().toISOString(); const handoverId = crypto.randomUUID();
    await db.batch([
      db.prepare("INSERT INTO clinical_handovers (id, injury_id, plan_id, from_user_id, to_user_id, summary, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?)").bind(handoverId, id, plan?.id ?? null, actor.id, toUserId, summary, now),
      db.prepare("INSERT INTO clinical_tasks (id, recipient_user_id, task_type, title, detail, injury_id, plan_id, handover_id, status, created_at) VALUES (?, ?, 'handover', ?, ?, ?, ?, ?, 'Open', ?)").bind(crypto.randomUUID(), toUserId, `Care handover awaiting acceptance — ${injury.title}`, summary, id, plan?.id ?? null, handoverId, now),
    ]);
    await writeAudit(actor.id, "CARE_HANDOVER_REQUESTED", "injury_episode", id, `Handover sent to ${recipient.name}: ${injury.title}`);
    return Response.json({ id: handoverId }, { status: 201 });
  } catch (error) { return apiError(error); }
}
