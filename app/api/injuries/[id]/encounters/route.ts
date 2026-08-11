import { ensureDatabase, writeAudit } from "../../../../../db/runtime";
import { apiError, cleanText, requireApiActor, requireClinicalWriteRole } from "../../../_utils";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireApiActor("clinical.notes.edit");
  if (actor instanceof Response) return actor;
  const forbidden = requireClinicalWriteRole(actor);
  if (forbidden) return forbidden;

  try {
    const { id } = await context.params;
    const payload = await request.json() as Record<string, unknown>;
    const encounterId = cleanText(payload.encounterId, 80);
    if (!encounterId) return Response.json({ error: "Choose an encounter to link." }, { status: 400 });

    const db = await ensureDatabase();
    const injury = await db.prepare("SELECT athlete_id AS athleteId, title FROM injury_episodes WHERE id = ?")
      .bind(id).first<{ athleteId: string; title: string }>();
    if (!injury) return Response.json({ error: "Injury episode not found." }, { status: 404 });
    const encounter = await db.prepare("SELECT athlete_id AS athleteId, encounter_type AS encounterType FROM encounters WHERE id = ?")
      .bind(encounterId).first<{ athleteId: string; encounterType: string }>();
    if (!encounter) return Response.json({ error: "Encounter not found." }, { status: 404 });
    if (encounter.athleteId !== injury.athleteId) {
      return Response.json({ error: "Only encounters for the same athlete can be linked." }, { status: 400 });
    }

    await db.prepare("INSERT OR IGNORE INTO injury_encounters (injury_id, encounter_id) VALUES (?, ?)").bind(id, encounterId).run();
    await writeAudit(actor.id, "LINKED", "injury", id, `${encounter.encounterType} linked to ${injury.title}`);
    return Response.json({ id });
  } catch (error) {
    return apiError(error);
  }
}
