import { ensureDatabase, writeAudit } from "../../../db/runtime";
import { apiError, cleanText, requireApiActor, requireClinicalWriteRole } from "../_utils";

const phaseTemplates = [
  { title: "Protect & restore", goals: "Control symptoms and restore confident movement", entry: "Clinical plan agreed", exit: "Symptoms controlled and foundational movement restored" },
  { title: "Build capacity", goals: "Restore strength, endurance, and tissue load tolerance", entry: "Foundational movement criteria met", exit: "Objective capacity criteria met with stable response" },
  { title: "Sport integration", goals: "Reintroduce progressive sport-specific demand", entry: "Capacity criteria met", exit: "Sport-specific loading completed without adverse response" },
  { title: "Return to performance", goals: "Restore full training and competition readiness", entry: "Sport-loading criteria met", exit: "Full exposure completed and shared return decision approved" },
];

function configuredPhases(value: unknown) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed) || parsed.length !== phaseTemplates.length) return phaseTemplates;
    return phaseTemplates.map((fallback, index) => {
      const item = parsed[index] && typeof parsed[index] === "object" ? parsed[index] as Record<string, unknown> : {};
      return {
        title: cleanText(item.title, 100) || fallback.title,
        goals: cleanText(item.goal, 600) || fallback.goals,
        entry: fallback.entry,
        exit: cleanText(item.exitCriteria, 600) || fallback.exit,
      };
    });
  } catch {
    return phaseTemplates;
  }
}

export async function POST(request: Request) {
  const actor = await requireApiActor("clinical.notes.create");
  if (actor instanceof Response) return actor;
  const forbidden = requireClinicalWriteRole(actor);
  if (forbidden) return forbidden;

  try {
    const payload = await request.json() as Record<string, unknown>;
    const injuryId = cleanText(payload.injuryId, 80);
    const title = cleanText(payload.title, 180);
    const startDate = cleanText(payload.startDate, 10);
    const targetDate = cleanText(payload.targetDate, 10) || null;
    const weeklyFrequency = cleanText(payload.weeklyFrequency, 3);
    const primaryGoal = cleanText(payload.primaryGoal, 1000);
    const precautions = cleanText(payload.precautions, 1000) || "None recorded";
    const nextReviewDate = cleanText(payload.nextReviewDate, 10) || null;
    const phases = configuredPhases(payload.phases);
    if (!injuryId || !title || !startDate || !weeklyFrequency || !primaryGoal) {
      return Response.json({ error: "Complete all required rehabilitation plan fields." }, { status: 400 });
    }
    if (!/^([1-9]|1[0-4])$/.test(weeklyFrequency)) {
      return Response.json({ error: "Weekly frequency must be a whole number from 1 to 14." }, { status: 400 });
    }

    const db = await ensureDatabase();
    const injury = await db.prepare(`SELECT i.title, i.stage, a.first_name AS firstName, a.last_name AS lastName
      FROM injury_episodes i JOIN athletes a ON a.id = i.athlete_id WHERE i.id = ?`).bind(injuryId)
      .first<{ title: string; stage: string; firstName: string; lastName: string }>();
    if (!injury) return Response.json({ error: "Injury episode not found." }, { status: 404 });
    if (injury.stage === "Closed") return Response.json({ error: "A rehabilitation plan cannot be opened for a closed injury episode." }, { status: 400 });
    const existing = await db.prepare("SELECT id FROM rehabilitation_plans WHERE injury_id = ? AND status = 'Active'").bind(injuryId).first();
    if (existing) return Response.json({ error: "This injury already has an active rehabilitation plan." }, { status: 409 });
    let practitioner = await db.prepare("SELECT id FROM practitioner_profiles WHERE user_id = ?").bind(actor.id).first<{ id: string }>();
    if (!practitioner) {
      practitioner = { id: `pr-${crypto.randomUUID()}` };
      await db.prepare(`INSERT INTO practitioner_profiles (id, user_id, specialty, credentials, clinic_city)
        VALUES (?, ?, ?, ?, ?)`).bind(practitioner.id, actor.id, actor.specialty, "SOPCare practitioner", actor.clinicCity).run();
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const statements = [
      db.prepare(`INSERT INTO rehabilitation_plans (id, injury_id, owner_practitioner_id, title, status, start_date, target_date, current_phase, overall_progress, weekly_frequency, primary_goal, precautions, next_review_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'Active', ?, ?, 1, 0, ?, ?, ?, ?, ?, ?)`)
        .bind(id, injuryId, practitioner.id, title, startDate, targetDate, weeklyFrequency, primaryGoal, precautions, nextReviewDate, now, now),
      ...phases.map((phase, index) => db.prepare(`INSERT INTO rehabilitation_phases (id, plan_id, phase_number, title, status, goals, entry_criteria, exit_criteria, progress, started_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`)
        .bind(crypto.randomUUID(), id, index + 1, phase.title, index === 0 ? "Active" : "Locked", phase.goals, phase.entry, phase.exit, index === 0 ? now : null, now, now)),
    ];
    await db.batch(statements);
    await writeAudit(actor.id, "CREATED", "rehabilitation_plan", id, `Rehabilitation plan opened for ${injury.firstName} ${injury.lastName}: ${title}`);
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
