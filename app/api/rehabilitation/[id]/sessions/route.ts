import { ensureDatabase, writeAudit } from "../../../../../db/runtime";
import { apiError, cleanText, requireApiActor, requireClinicalWriteRole } from "../../../_utils";

function score(value: unknown, max = 10) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(max, Math.round(parsed))) : null;
}

function optionalNumber(value: unknown, min: number, max: number) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireApiActor("clinical.notes.create");
  if (actor instanceof Response) return actor;
  const forbidden = requireClinicalWriteRole(actor);
  if (forbidden) return forbidden;

  try {
    const { id } = await context.params;
    const payload = await request.json() as Record<string, unknown>;
    const sessionDate = cleanText(payload.sessionDate, 25);
    const sessionType = cleanText(payload.sessionType, 120);
    const status = payload.status === "Scheduled" ? "Scheduled" : "Completed";
    const notes = cleanText(payload.notes, 2000);
    const nextAction = cleanText(payload.nextAction, 1000) || notes;
    const loadScore = score(payload.loadScore);
    const painPre = score(payload.painPre);
    const painPost = score(payload.painPost);
    const phaseProgress = score(payload.phaseProgress, 100);
    if (!sessionDate || !sessionType || !notes) {
      return Response.json({ error: "Session date, type, and session comment are required." }, { status: 400 });
    }
    if (status === "Completed" && phaseProgress === null) {
      return Response.json({ error: "Completed sessions require the current phase progress." }, { status: 400 });
    }

    const db = await ensureDatabase();
    const plan = await db.prepare("SELECT title, current_phase AS currentPhase, status FROM rehabilitation_plans WHERE id = ?")
      .bind(id).first<{ title: string; currentPhase: number; status: string }>();
    if (!plan) return Response.json({ error: "Rehabilitation plan not found." }, { status: 404 });
    if (plan.status !== "Active") return Response.json({ error: "Only active plans can receive sessions." }, { status: 400 });
    const phase = await db.prepare("SELECT id, progress FROM rehabilitation_phases WHERE plan_id = ? AND phase_number = ?")
      .bind(id, plan.currentPhase).first<{ id: string; progress: number }>();
    if (!phase) return Response.json({ error: "Current rehabilitation phase not found." }, { status: 404 });
    if (phase.progress >= 100) return Response.json({ error: "Complete the current phase before recording another session." }, { status: 400 });
    const practitioner = await db.prepare("SELECT id FROM practitioner_profiles WHERE user_id = ?").bind(actor.id).first<{ id: string }>();
    const practitionerId = practitioner?.id ?? "pr-lina";
    const phaseCount = await db.prepare("SELECT COUNT(*) AS count FROM rehabilitation_phases WHERE plan_id = ?").bind(id).first<{ count: number }>();
    const now = new Date().toISOString();
    const sessionId = crypto.randomUUID();
    const statements = [
      db.prepare(`INSERT INTO rehabilitation_sessions (id, plan_id, phase_id, practitioner_id, session_date, session_type, status, load_score, pain_pre, pain_post, phase_progress, notes, next_action, completed_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(sessionId, id, phase.id, practitionerId, sessionDate, sessionType, status, loadScore, painPre, painPost, phaseProgress, notes, nextAction, status === "Completed" ? now : null, now, now),
    ];
    const measurements: Array<{ metricType: string; label: string; numericValue: number | null; textValue: string; unit: string; context: string }> = [];
    const painActivity = optionalNumber(payload.painActivity, 0, 10);
    if (painActivity !== null) measurements.push({ metricType: "pain", label: "Activity pain", numericValue: painActivity, textValue: "", unit: "/10", context: cleanText(payload.painContext, 120) || "During activity" });
    const romDegrees = optionalNumber(payload.romDegrees, -30, 220);
    if (romDegrees !== null) measurements.push({ metricType: "rom", label: cleanText(payload.romMovement, 80) || "Range of motion", numericValue: romDegrees, textValue: "", unit: "°", context: cleanText(payload.romMode, 20) || "AROM" });
    const swellingGrade = cleanText(payload.swellingGrade, 30);
    if (swellingGrade) measurements.push({ metricType: "swelling", label: "Effusion", numericValue: null, textValue: swellingGrade, unit: "", context: "Clinical grade" });
    const circumference = optionalNumber(payload.swellingCircumference, 0, 200);
    if (circumference !== null) measurements.push({ metricType: "swelling", label: "Circumference", numericValue: circumference, textValue: "", unit: cleanText(payload.swellingUnit, 10) || "cm", context: cleanText(payload.swellingLocation, 100) || "Measurement landmark not specified" });
    const strengthValue = optionalNumber(payload.strengthValue, 0, 200);
    if (strengthValue !== null) measurements.push({ metricType: "strength", label: cleanText(payload.strengthMovement, 80) || "Strength", numericValue: strengthValue, textValue: "", unit: cleanText(payload.strengthUnit, 20) || "/5", context: cleanText(payload.strengthMethod, 60) || "Manual muscle testing" });
    const neuromuscular = cleanText(payload.neuromuscularStatus, 120);
    if (neuromuscular) measurements.push({ metricType: "neuromuscular", label: "Neuromuscular control", numericValue: null, textValue: neuromuscular, unit: "", context: cleanText(payload.neuromuscularContext, 100) || "" });
    const mobility = cleanText(payload.mobilityStatus, 120);
    const assistiveDevice = cleanText(payload.assistiveDevice, 80);
    if (mobility || assistiveDevice) measurements.push({ metricType: "mobility", label: "Mobility", numericValue: null, textValue: mobility || "Not specified", unit: "", context: assistiveDevice ? `Assistive device: ${assistiveDevice}` : "" });
    const response = cleanText(payload.clinicalResponse, 40);
    if (response) measurements.push({ metricType: "response", label: "Clinical response", numericValue: null, textValue: response, unit: "", context: "Compared with previous session" });
    statements.push(...measurements.map((measurement) => db.prepare(`INSERT INTO rehabilitation_measurements
      (id, session_id, plan_id, metric_type, label, numeric_value, text_value, unit, context, recorded_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), sessionId, id, measurement.metricType, measurement.label, measurement.numericValue, measurement.textValue, measurement.unit, measurement.context, sessionDate, now, now)));
    if (status === "Completed" && phaseProgress !== null) {
      const overallProgress = Math.round((((plan.currentPhase - 1) * 100) + phaseProgress) / Math.max(1, phaseCount?.count ?? 1));
      statements.push(db.prepare("UPDATE rehabilitation_phases SET progress = ?, updated_at = ? WHERE id = ?").bind(phaseProgress, now, phase.id));
      statements.push(db.prepare("UPDATE rehabilitation_plans SET overall_progress = ?, updated_at = ? WHERE id = ?").bind(overallProgress, now, id));
    }
    await db.batch(statements);
    await writeAudit(actor.id, status === "Completed" ? "SESSION_COMPLETED" : "SESSION_SCHEDULED", "rehabilitation_plan", id, `${sessionType} ${status.toLowerCase()} for ${plan.title}`);
    return Response.json({ id: sessionId }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
