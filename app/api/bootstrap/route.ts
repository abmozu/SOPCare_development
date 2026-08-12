import { ensureDatabase } from "../../../db/runtime";
import { apiError, requireApiActor } from "../_utils";

export async function GET() {
  const actor = await requireApiActor();
  if (actor instanceof Response) return actor;

  try {
    const db = await ensureDatabase();
    // The clinical workspace must remain available while a database migration is
    // being rolled out.  Older staging databases do not yet have the optional
    // practitioner clinic-default columns, so retry with the stable profile
    // shape and use the specialty defaults below.
    let actorProfile: { name: string; specialty: string | null; defaultEncounterType: string | null; clinicCity: string | null; clinicType: string | null; clinicLocation: string | null } | null = null;
    try {
      actorProfile = await db.prepare(`SELECT u.full_name AS name, pp.specialty,
        pp.default_encounter_type AS defaultEncounterType, pp.clinic_city AS clinicCity,
        pp.clinic_type AS clinicType, pp.clinic_location AS clinicLocation
        FROM users u LEFT JOIN practitioner_profiles pp ON pp.user_id = u.id
        WHERE u.id = ? OR u.email = ? LIMIT 1`).bind(actor.id, actor.email).first<typeof actorProfile>();
    } catch {
      const legacyProfile = await db.prepare(`SELECT u.full_name AS name, pp.specialty
        FROM users u LEFT JOIN practitioner_profiles pp ON pp.user_id = u.id
        WHERE u.id = ? OR u.email = ? LIMIT 1`).bind(actor.id, actor.email).first<{ name: string; specialty: string | null }>();
      actorProfile = legacyProfile ? { ...legacyProfile, defaultEncounterType: null, clinicCity: null, clinicType: null, clinicLocation: null } : null;
    }
    const specialty = actorProfile?.specialty ?? actor.specialty;
    const isPhysio = specialty.includes("Physio");
    const isNutrition = specialty.includes("Nutrition");
    const isPsychology = specialty.includes("Psych");
    const resolvedActor = {
      ...actor,
      name: actorProfile?.name ?? actor.name,
      specialty,
      defaultEncounterType: actorProfile?.defaultEncounterType ?? (isPhysio ? "Physiotherapy Review" : isNutrition ? "Nutrition Follow-up" : isPsychology ? "Performance Psychology" : "Medical Review"),
      clinicCity: actorProfile?.clinicCity ?? (isPhysio || isPsychology ? "Dhahran" : "Riyadh"),
      clinicType: actorProfile?.clinicType ?? (isPhysio ? "Physiotherapy Clinic" : isNutrition ? "Sports Nutrition Clinic" : isPsychology ? "Sports Psychology Clinic" : "Sports Medicine Clinic"),
      clinicLocation: actorProfile?.clinicLocation ?? (isPhysio || isPsychology ? "SOPCare Dhahran Training Center" : "Riyadh High Performance Center"),
    };
    const [athletes, encounters, practitioners, activities, sports, teams, injuries, injuryHistory, rehabilitationPlans, rehabilitationPhases, rehabilitationExercises, rehabilitationSessions] = await Promise.all([
      db.prepare(`
        SELECT a.id, a.mrn, a.first_name AS firstName, a.last_name AS lastName,
          a.date_of_birth AS dateOfBirth, a.sex, a.nationality, a.discipline,
          a.dominant_side AS dominantSide, a.status, a.medical_alerts AS medicalAlerts,
          a.allergies, a.chronic_conditions AS chronicConditions,
          a.prohibited_medications AS prohibitedMedications,
          a.emergency_contact AS emergencyContact, a.follow_up_date AS followUpDate,
          a.accent, a.updated_at AS updatedAt, s.name AS sport,
          COALESCE(t.name, 'Unassigned') AS team,
          COALESCE(lead.full_name, 'Unassigned') AS leadPractitioner,
          (SELECT MAX(e.encounter_date) FROM encounters e WHERE e.athlete_id = a.id) AS lastEncounter
        FROM athletes a
        JOIN sports s ON s.id = a.sport_id
        LEFT JOIN athlete_team_memberships atm ON atm.athlete_id = a.id AND atm.is_primary = 1
        LEFT JOIN teams t ON t.id = atm.team_id
        LEFT JOIN athlete_care_team act ON act.athlete_id = a.id AND act.is_lead = 1
        LEFT JOIN practitioner_profiles pp ON pp.id = act.practitioner_id
        LEFT JOIN users lead ON lead.id = pp.user_id
        ORDER BY a.updated_at DESC, a.last_name ASC
      `).all(),
      db.prepare(`
        SELECT e.id, e.athlete_id AS athleteId, e.encounter_date AS encounterDate,
          e.encounter_type AS encounterType, e.clinic_city AS clinicCity,
          e.clinic_type AS clinicType, e.clinic_location AS clinicLocation, e.reason,
          CASE WHEN e.visibility = 'Restricted' THEN 'Restricted clinical content' ELSE e.subjective END AS subjective,
          CASE WHEN e.visibility = 'Restricted' THEN 'Restricted clinical content' ELSE e.objective END AS objective,
          CASE WHEN e.visibility = 'Restricted' THEN 'Restricted clinical content' ELSE e.assessment END AS assessment,
          CASE WHEN e.visibility = 'Restricted' THEN 'Restricted clinical content' ELSE e.plan END AS plan,
          CASE WHEN e.visibility = 'Restricted' THEN 'Restricted diagnosis' ELSE e.diagnosis END AS diagnosis,
          e.visibility, e.follow_up_date AS followUpDate,
          u.full_name AS practitioner, pp.specialty,
          CASE WHEN u.id = ? OR u.email = ? THEN 1 ELSE 0 END AS canEdit,
          ie.injury_id AS injuryId, injury.title AS injuryTitle,
          (SELECT COUNT(*) FROM encounter_amendments ea WHERE ea.encounter_id = e.id) AS amendmentCount
        FROM encounters e
        JOIN practitioner_profiles pp ON pp.id = e.practitioner_id
        JOIN users u ON u.id = pp.user_id
        LEFT JOIN injury_encounters ie ON ie.encounter_id = e.id
        LEFT JOIN injury_episodes injury ON injury.id = ie.injury_id
        ORDER BY e.encounter_date DESC
      `).bind(actor.id, actor.email).all(),
      db.prepare(`
        SELECT pp.id, u.full_name AS name, pp.specialty, pp.credentials
        FROM practitioner_profiles pp JOIN users u ON u.id = pp.user_id
        ORDER BY u.full_name
      `).all(),
      db.prepare(`
        SELECT al.id, al.action, al.entity_type AS entityType, al.entity_id AS entityId,
          al.summary, al.created_at AS createdAt, COALESCE(u.full_name, 'SOPCare user') AS actor
        FROM audit_logs al LEFT JOIN users u ON u.id = al.actor_id
        ORDER BY al.created_at DESC, al.id DESC LIMIT 12
      `).all(),
      db.prepare("SELECT id, name FROM sports ORDER BY name").all(),
      db.prepare("SELECT id, name, category FROM teams ORDER BY name").all(),
      db.prepare(`
        SELECT i.id, i.athlete_id AS athleteId, i.title,
          i.diagnosis_status AS diagnosisStatus, i.body_area AS bodyArea,
          i.laterality, i.onset_date AS onsetDate, i.mechanism, i.severity,
          i.participation_status AS participationStatus, i.stage,
          i.next_action AS nextAction, i.review_date AS reviewDate,
          i.expected_return_date AS expectedReturnDate,
          i.closure_summary AS closureSummary, i.closed_at AS closedAt,
          i.created_at AS createdAt, i.updated_at AS updatedAt,
          a.first_name || ' ' || a.last_name AS athleteName, a.mrn,
          s.name AS sport, COALESCE(t.name, 'Unassigned') AS team,
          u.full_name AS leadPractitioner,
          (SELECT COUNT(*) FROM injury_encounters link WHERE link.injury_id = i.id) AS linkedEncounterCount
        FROM injury_episodes i
        JOIN athletes a ON a.id = i.athlete_id
        JOIN sports s ON s.id = a.sport_id
        JOIN practitioner_profiles pp ON pp.id = i.lead_practitioner_id
        JOIN users u ON u.id = pp.user_id
        LEFT JOIN athlete_team_memberships atm ON atm.athlete_id = a.id AND atm.is_primary = 1
        LEFT JOIN teams t ON t.id = atm.team_id
        ORDER BY CASE WHEN i.stage = 'Closed' THEN 1 ELSE 0 END, i.review_date ASC, i.updated_at DESC
      `).all(),
      db.prepare(`
        SELECT h.id, h.injury_id AS injuryId, h.from_stage AS fromStage,
          h.to_stage AS toStage, h.note, COALESCE(u.full_name, 'SOPCare user') AS changedBy,
          h.created_at AS createdAt
        FROM injury_status_history h
        LEFT JOIN users u ON u.id = h.changed_by
        ORDER BY h.created_at DESC
      `).all(),
      db.prepare(`
        SELECT rp.id, rp.injury_id AS injuryId, rp.title, rp.status,
          rp.start_date AS startDate, rp.target_date AS targetDate,
          rp.current_phase AS currentPhase, rp.overall_progress AS overallProgress,
          rp.weekly_frequency AS weeklyFrequency, rp.primary_goal AS primaryGoal,
          rp.precautions, rp.next_review_date AS nextReviewDate,
          rp.created_at AS createdAt, rp.updated_at AS updatedAt,
          i.athlete_id AS athleteId, i.title AS injuryTitle,
          a.first_name || ' ' || a.last_name AS athleteName, a.mrn,
          s.name AS sport, u.full_name AS ownerPractitioner,
          phase.id AS currentPhaseId, phase.title AS currentPhaseTitle,
          phase.progress AS currentPhaseProgress, phase.exit_criteria AS currentExitCriteria,
          (SELECT COUNT(*) FROM rehabilitation_phases p WHERE p.plan_id = rp.id) AS phaseCount,
          (SELECT COUNT(*) FROM rehabilitation_sessions rs WHERE rs.plan_id = rp.id AND rs.status = 'Completed') AS completedSessionCount,
          (SELECT MIN(rs.session_date) FROM rehabilitation_sessions rs WHERE rs.plan_id = rp.id AND rs.status = 'Scheduled') AS nextSessionDate
        FROM rehabilitation_plans rp
        JOIN injury_episodes i ON i.id = rp.injury_id
        JOIN athletes a ON a.id = i.athlete_id
        JOIN sports s ON s.id = a.sport_id
        JOIN practitioner_profiles owner ON owner.id = rp.owner_practitioner_id
        JOIN users u ON u.id = owner.user_id
        LEFT JOIN rehabilitation_phases phase ON phase.plan_id = rp.id AND phase.phase_number = rp.current_phase
        ORDER BY CASE WHEN rp.status = 'Active' THEN 0 ELSE 1 END, rp.next_review_date ASC, rp.updated_at DESC
      `).all(),
      db.prepare(`
        SELECT id, plan_id AS planId, phase_number AS phaseNumber, title, status,
          goals, entry_criteria AS entryCriteria, exit_criteria AS exitCriteria,
          progress, started_at AS startedAt, completed_at AS completedAt
        FROM rehabilitation_phases ORDER BY plan_id, phase_number
      `).all(),
      db.prepare(`
        SELECT id, phase_id AS phaseId, name, dosage, target, status, sort_order AS sortOrder
        FROM rehabilitation_exercises ORDER BY phase_id, sort_order
      `).all(),
      db.prepare(`
        SELECT rs.id, rs.plan_id AS planId, rs.phase_id AS phaseId,
          rs.session_date AS sessionDate, rs.session_type AS sessionType, rs.status,
          rs.load_score AS loadScore, rs.pain_pre AS painPre, rs.pain_post AS painPost,
          rs.phase_progress AS phaseProgress, rs.notes, rs.next_action AS nextAction,
          rs.completed_at AS completedAt, u.full_name AS practitioner
        FROM rehabilitation_sessions rs
        JOIN practitioner_profiles pp ON pp.id = rs.practitioner_id
        JOIN users u ON u.id = pp.user_id
        ORDER BY rs.session_date DESC
      `).all(),
    ]);

    const athleteRows = athletes.results as Array<{ encounterDate?: string; followUpDate?: string; status: string }>;
    const encounterRows = encounters.results as Array<{ encounterDate: string }>;
    const injuryRows = injuries.results as Array<{ stage: string }>;
    const rehabilitationRows = rehabilitationPlans.results as Array<{ status: string; nextReviewDate?: string; currentPhaseProgress: number }>;
    const rehabilitationSessionRows = rehabilitationSessions.results as Array<{ status: string; sessionDate: string }>;
    const today = new Date().toISOString().slice(0, 10);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    return Response.json({
      actor: resolvedActor,
      athletes: athleteRows,
      encounters: encounterRows,
      practitioners: practitioners.results,
      activities: activities.results,
      sports: sports.results,
      teams: teams.results,
      injuries: injuryRows,
      injuryHistory: injuryHistory.results,
      rehabilitationPlans: rehabilitationRows,
      rehabilitationPhases: rehabilitationPhases.results,
      rehabilitationExercises: rehabilitationExercises.results,
      rehabilitationSessions: rehabilitationSessionRows,
      stats: {
        activeAthletes: athleteRows.length,
        encountersThisWeek: encounterRows.filter((row) => String(row.encounterDate) >= weekStart.toISOString()).length,
        followUps: athleteRows.filter((row) => row.followUpDate && String(row.followUpDate) >= today).length,
        modifiedTraining: athleteRows.filter((row) => row.status === "Modified Training" || row.status === "Under Treatment").length,
        openInjuries: injuryRows.filter((row) => row.stage !== "Closed").length,
        rtsReviews: injuryRows.filter((row) => row.stage === "Return-to-Sport Review").length,
        activeRehabPlans: rehabilitationRows.filter((row) => row.status === "Active").length,
        rehabSessionsThisWeek: rehabilitationSessionRows.filter((row) => row.status === "Completed" && String(row.sessionDate) >= weekStart.toISOString()).length,
        rehabCriteriaReady: rehabilitationRows.filter((row) => row.status === "Active" && row.currentPhaseProgress >= 80).length,
        rehabReviewsDue: rehabilitationRows.filter((row) => row.status === "Active" && row.nextReviewDate && String(row.nextReviewDate) <= today).length,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
