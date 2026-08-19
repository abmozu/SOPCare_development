import { getPostgres } from "./postgres";
import { getSotcAthletes } from "./sotc-athletes";
import { getSotcBirthdates } from "./sotc-birthdates";
import { env } from "cloudflare:workers";

const seedStatements = [
  ["INSERT OR IGNORE INTO roles (id, name) VALUES (?, ?)", "role-physician", "Sports Physician"],
  ["INSERT OR IGNORE INTO roles (id, name) VALUES (?, ?)", "role-physio", "Physiotherapist"],
  ["INSERT OR IGNORE INTO roles (id, name) VALUES (?, ?)", "role-nutrition", "Sports Nutritionist"],
  ["INSERT OR IGNORE INTO roles (id, name) VALUES (?, ?)", "role-psych", "Sports Psychologist"],
  ["INSERT OR IGNORE INTO roles (id, name) VALUES (?, ?)", "role-admin", "Clinical Administrator"],
  ["INSERT OR IGNORE INTO sports (id, name) VALUES (?, ?)", "sport-athletics", "Athletics"],
  ["INSERT OR IGNORE INTO sports (id, name) VALUES (?, ?)", "sport-swimming", "Swimming"],
  ["INSERT OR IGNORE INTO sports (id, name) VALUES (?, ?)", "sport-taekwondo", "Taekwondo"],
  ["INSERT OR IGNORE INTO sports (id, name) VALUES (?, ?)", "sport-wheelchair", "Wheelchair Racing"],
  ["INSERT OR IGNORE INTO teams (id, name, category) VALUES (?, ?, ?)", "team-elite", "National Elite Squad", "Olympic"],
  ["INSERT OR IGNORE INTO teams (id, name, category) VALUES (?, ?, ?)", "team-para", "National Para Squad", "Paralympic"],
  ["INSERT OR IGNORE INTO teams (id, name, category) VALUES (?, ?, ?)", "team-development", "Performance Pathway", "Development"],
  ["INSERT OR IGNORE INTO users (id, email, full_name) VALUES (?, ?, ?)", "user-lina", "clinician@example.invalid", "Demo Clinician"],
  ["INSERT OR IGNORE INTO users (id, email, full_name) VALUES (?, ?, ?)", "user-omar", "therapist@example.invalid", "Demo Therapist"],
  ["INSERT OR IGNORE INTO users (id, email, full_name) VALUES (?, ?, ?)", "user-sara", "nutritionist@example.invalid", "Demo Nutritionist"],
  ["INSERT OR IGNORE INTO users (id, email, full_name) VALUES (?, ?, ?)", "user-noura", "psychologist@example.invalid", "Demo Psychologist"],
  ["INSERT OR IGNORE INTO users (id, email, full_name) VALUES (?, ?, ?)", "user-yousef", "physician@example.invalid", "Demo Physician"],
  ["INSERT OR IGNORE INTO practitioner_profiles (id, user_id, specialty, credentials) VALUES (?, ?, ?, ?)", "pr-lina", "user-lina", "Sports Medicine", "MD"],
  ["INSERT OR IGNORE INTO practitioner_profiles (id, user_id, specialty, credentials) VALUES (?, ?, ?, ?)", "pr-omar", "user-omar", "Physiotherapy", "MSc PT"],
  ["INSERT OR IGNORE INTO practitioner_profiles (id, user_id, specialty, credentials) VALUES (?, ?, ?, ?)", "pr-sara", "user-sara", "Sports Nutrition", "RD"],
  ["INSERT OR IGNORE INTO practitioner_profiles (id, user_id, specialty, credentials) VALUES (?, ?, ?, ?)", "pr-noura", "user-noura", "Sports Psychology", "PhD"],
  ["INSERT OR IGNORE INTO practitioner_profiles (id, user_id, specialty, credentials) VALUES (?, ?, ?, ?)", "pr-yousef", "user-yousef", "Clinical Administration", "CHIM"],
  ["INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)", "user-lina", "role-physician"],
  ["INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)", "user-omar", "role-physio"],
  ["INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)", "user-sara", "role-nutrition"],
  ["INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)", "user-noura", "role-psych"],
  ["INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)", "user-yousef", "role-admin"],
  ["INSERT OR IGNORE INTO athletes (id, mrn, first_name, last_name, date_of_birth, sex, sport_id, discipline, dominant_side, status, medical_alerts, emergency_contact, follow_up_date, accent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "ath-1", "DEMO-0001", "Demo", "Athlete 01", "1998-03-14", "Male", "sport-athletics", "400 m", "Right", "Modified Training", "NSAID sensitivity", "Demo Contact 01 · Not applicable", "2026-08-07", "#006C46"],
  ["INSERT OR IGNORE INTO athletes (id, mrn, first_name, last_name, date_of_birth, sex, sport_id, discipline, dominant_side, status, medical_alerts, emergency_contact, follow_up_date, accent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "ath-2", "DEMO-0002", "Demo", "Athlete 02", "2001-11-02", "Female", "sport-taekwondo", "−57 kg", "Right", "Available", "None recorded", "Demo Contact 02 · Not applicable", null, "#BB7B43"],
  ["INSERT OR IGNORE INTO athletes (id, mrn, first_name, last_name, date_of_birth, sex, sport_id, discipline, dominant_side, status, medical_alerts, emergency_contact, follow_up_date, accent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "ath-3", "DEMO-0003", "Demo", "Athlete 03", "1995-07-23", "Male", "sport-wheelchair", "T54 800 m", "Right", "Return-to-Sport Review", "Latex allergy", "Demo Contact 03 · Not applicable", "2026-08-06", "#397F91"],
  ["INSERT OR IGNORE INTO athletes (id, mrn, first_name, last_name, date_of_birth, sex, sport_id, discipline, dominant_side, status, medical_alerts, emergency_contact, follow_up_date, accent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "ath-4", "DEMO-0004", "Demo", "Athlete 04", "2003-05-19", "Female", "sport-swimming", "200 m freestyle", "Left", "Under Treatment", "Asthma action plan on file", "Demo Contact 04 · Not applicable", "2026-08-05", "#6A5E8C"],
  ["INSERT OR IGNORE INTO athletes (id, mrn, first_name, last_name, date_of_birth, sex, sport_id, discipline, dominant_side, status, medical_alerts, emergency_contact, follow_up_date, accent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "ath-5", "DEMO-0005", "Demo", "Athlete 05", "1999-09-30", "Male", "sport-athletics", "Long jump", "Right", "Available", "None recorded", "Demo Contact 05 · Not applicable", null, "#2F765F"],
  ["INSERT OR IGNORE INTO athletes (id, mrn, first_name, last_name, date_of_birth, sex, sport_id, discipline, dominant_side, status, medical_alerts, emergency_contact, follow_up_date, accent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "ath-6", "DEMO-0006", "Demo", "Athlete 06", "2000-01-16", "Female", "sport-wheelchair", "T53 400 m", "Left", "Available", "None recorded", "Demo Contact 06 · Not applicable", null, "#A45D65"],
  ["INSERT OR IGNORE INTO athletes (id, mrn, first_name, last_name, date_of_birth, sex, sport_id, discipline, dominant_side, status, medical_alerts, emergency_contact, follow_up_date, accent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "ath-7", "DEMO-0007", "Demo", "Athlete 07", "2004-08-11", "Female", "sport-swimming", "100 m butterfly", "Right", "Modified Training", "None recorded", "Demo Contact 07 · Not applicable", "2026-08-10", "#B1854F"],
  ["INSERT OR IGNORE INTO athletes (id, mrn, first_name, last_name, date_of_birth, sex, sport_id, discipline, dominant_side, status, medical_alerts, emergency_contact, follow_up_date, accent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "ath-8", "DEMO-0008", "Demo", "Athlete 08", "1997-12-04", "Male", "sport-taekwondo", "+80 kg", "Left", "Available", "None recorded", "Demo Contact 08 · Not applicable", null, "#4D7D72"],
  ["INSERT OR IGNORE INTO athlete_team_memberships (athlete_id, team_id) VALUES (?, ?)", "ath-1", "team-elite"],
  ["INSERT OR IGNORE INTO athlete_team_memberships (athlete_id, team_id) VALUES (?, ?)", "ath-2", "team-elite"],
  ["INSERT OR IGNORE INTO athlete_team_memberships (athlete_id, team_id) VALUES (?, ?)", "ath-3", "team-para"],
  ["INSERT OR IGNORE INTO athlete_team_memberships (athlete_id, team_id) VALUES (?, ?)", "ath-4", "team-development"],
  ["INSERT OR IGNORE INTO athlete_team_memberships (athlete_id, team_id) VALUES (?, ?)", "ath-5", "team-elite"],
  ["INSERT OR IGNORE INTO athlete_team_memberships (athlete_id, team_id) VALUES (?, ?)", "ath-6", "team-para"],
  ["INSERT OR IGNORE INTO athlete_team_memberships (athlete_id, team_id) VALUES (?, ?)", "ath-7", "team-development"],
  ["INSERT OR IGNORE INTO athlete_team_memberships (athlete_id, team_id) VALUES (?, ?)", "ath-8", "team-elite"],
  ["INSERT OR IGNORE INTO athlete_care_team (athlete_id, practitioner_id, is_lead) VALUES (?, ?, ?)", "ath-1", "pr-lina", 1],
  ["INSERT OR IGNORE INTO athlete_care_team (athlete_id, practitioner_id, is_lead) VALUES (?, ?, ?)", "ath-1", "pr-omar", 0],
  ["INSERT OR IGNORE INTO athlete_care_team (athlete_id, practitioner_id, is_lead) VALUES (?, ?, ?)", "ath-2", "pr-lina", 1],
  ["INSERT OR IGNORE INTO athlete_care_team (athlete_id, practitioner_id, is_lead) VALUES (?, ?, ?)", "ath-3", "pr-omar", 1],
  ["INSERT OR IGNORE INTO athlete_care_team (athlete_id, practitioner_id, is_lead) VALUES (?, ?, ?)", "ath-4", "pr-lina", 1],
  ["INSERT OR IGNORE INTO athlete_care_team (athlete_id, practitioner_id, is_lead) VALUES (?, ?, ?)", "ath-4", "pr-noura", 0],
  ["INSERT OR IGNORE INTO athlete_care_team (athlete_id, practitioner_id, is_lead) VALUES (?, ?, ?)", "ath-5", "pr-sara", 1],
  ["INSERT OR IGNORE INTO athlete_care_team (athlete_id, practitioner_id, is_lead) VALUES (?, ?, ?)", "ath-6", "pr-omar", 1],
  ["INSERT OR IGNORE INTO athlete_care_team (athlete_id, practitioner_id, is_lead) VALUES (?, ?, ?)", "ath-7", "pr-lina", 1],
  ["INSERT OR IGNORE INTO athlete_care_team (athlete_id, practitioner_id, is_lead) VALUES (?, ?, ?)", "ath-8", "pr-lina", 1],
  ["INSERT OR IGNORE INTO encounters (id, athlete_id, practitioner_id, encounter_date, encounter_type, reason, subjective, objective, assessment, plan, visibility, follow_up_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "enc-1", "ath-1", "pr-omar", "2026-08-04T09:30:00Z", "Physiotherapy Review", "Posterior thigh tightness during acceleration", "Reports improving confidence at 80% running intensity.", "Pain-free isometric testing; mild asymmetry on repeated hop test.", "Progressing appropriately within modified training.", "Advance running exposure and review after two field sessions.", "Care team", "2026-08-07"],
  ["INSERT OR IGNORE INTO encounters (id, athlete_id, practitioner_id, encounter_date, encounter_type, reason, subjective, objective, assessment, plan, visibility, follow_up_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "enc-2", "ath-4", "pr-lina", "2026-08-04T07:45:00Z", "Medical Review", "Shoulder pain after high-volume swim block", "Pain settles with rest and is absent during daily activity.", "Full range; discomfort in end-range external rotation.", "Training-related shoulder overload; no red flags identified.", "Reduce pull volume for 72 hours and reassess response.", "Care team", "2026-08-05"],
  ["INSERT OR IGNORE INTO encounters (id, athlete_id, practitioner_id, encounter_date, encounter_type, reason, assessment, plan, visibility, follow_up_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "enc-3", "ath-3", "pr-lina", "2026-08-05T08:00:00Z", "Return-to-Sport Review", "Final medical review before competition simulation", "Draft assessment pending functional review.", "Confirm shared decision after care team huddle.", "Care team", "2026-08-06"],
  ["INSERT OR IGNORE INTO encounters (id, athlete_id, practitioner_id, encounter_date, encounter_type, reason, assessment, plan, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", "enc-4", "ath-2", "pr-sara", "2026-08-01T12:00:00Z", "Nutrition Follow-up", "Competition-week fueling review", "Fueling plan is well tolerated.", "Maintain plan and monitor morning body-mass trend.", "Care team"],
  ["INSERT OR IGNORE INTO encounters (id, athlete_id, practitioner_id, encounter_date, encounter_type, reason, assessment, plan, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", "enc-5", "ath-6", "pr-omar", "2026-07-31T10:15:00Z", "Physiotherapy Review", "Chair setup and upper-limb load check", "No current pain; setup adjustment appropriate.", "Continue monitoring during high-load sessions.", "Care team"],
  ["INSERT OR IGNORE INTO encounters (id, athlete_id, practitioner_id, encounter_date, encounter_type, reason, assessment, plan, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", "enc-6", "ath-7", "pr-lina", "2026-07-30T08:30:00Z", "Medical Review", "Fatigue after travel", "Likely transient travel-related fatigue.", "Modified morning session; review recovery markers.", "Care team"],
  ["INSERT OR IGNORE INTO encounters (id, athlete_id, practitioner_id, encounter_date, encounter_type, reason, assessment, plan, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", "enc-7", "ath-8", "pr-lina", "2026-07-28T11:00:00Z", "Medical Screening", "Pre-camp health screen", "No new medical concerns.", "Full training clearance.", "Care team"],
  ["INSERT OR IGNORE INTO encounters (id, athlete_id, practitioner_id, encounter_date, encounter_type, reason, assessment, plan, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", "enc-8", "ath-5", "pr-sara", "2026-07-27T13:15:00Z", "Nutrition Assessment", "Training-day intake review", "Opportunity to improve post-session recovery intake.", "Trial revised recovery snack for seven days.", "Care team"],
  ["INSERT OR IGNORE INTO encounters (id, athlete_id, practitioner_id, encounter_date, encounter_type, reason, assessment, plan, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", "enc-9", "ath-1", "pr-lina", "2026-07-26T09:00:00Z", "Medical Review", "Hamstring loading response", "Stable improvement without adverse response.", "Continue coordinated progression with physiotherapy.", "Care team"],
  ["INSERT OR IGNORE INTO encounters (id, athlete_id, practitioner_id, encounter_date, encounter_type, reason, assessment, plan, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", "enc-10", "ath-3", "pr-noura", "2026-07-24T14:00:00Z", "Performance Psychology", "Competition readiness check-in", "Restricted note content.", "Restricted plan content.", "Restricted"],
  ["INSERT OR IGNORE INTO audit_logs (actor_id, action, entity_type, entity_id, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)", "user-lina", "CREATED", "encounter", "enc-2", "Medical encounter created for Demo Athlete 04", "2026-08-04T08:22:00Z"],
  ["INSERT OR IGNORE INTO audit_logs (actor_id, action, entity_type, entity_id, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)", "user-omar", "CREATED", "encounter", "enc-1", "Physiotherapy review created for Demo Athlete 01", "2026-08-04T10:05:00Z"],
  ["INSERT OR IGNORE INTO audit_logs (actor_id, action, entity_type, entity_id, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)", "user-lina", "CREATED", "encounter", "enc-3", "Return-to-sport review drafted for Demo Athlete 03", "2026-08-05T08:00:00Z"],
];

const injurySeedStatements = [
  ["INSERT OR IGNORE INTO injury_episodes (id, athlete_id, lead_practitioner_id, title, diagnosis_status, body_area, laterality, onset_date, mechanism, severity, participation_status, stage, next_action, review_date, expected_return_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "inj-1", "ath-1", "pr-omar", "Right hamstring strain", "Confirmed", "Posterior thigh", "Right", "2026-07-22", "High-speed running", "Moderate", "Modified Training", "Under Treatment", "Progress field running exposure after two symptom-free sessions", "2026-08-07", "2026-08-18", "2026-07-22T08:30:00Z", "2026-08-04T10:05:00Z"],
  ["INSERT OR IGNORE INTO injury_episodes (id, athlete_id, lead_practitioner_id, title, diagnosis_status, body_area, laterality, onset_date, mechanism, severity, participation_status, stage, next_action, review_date, expected_return_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "inj-2", "ath-3", "pr-lina", "Right shoulder overload", "Confirmed", "Shoulder", "Right", "2026-07-18", "Repetitive propulsion load", "Moderate", "Return-to-Sport Review", "Return-to-Sport Review", "Complete competition simulation and multidisciplinary review", "2026-08-06", "2026-08-12", "2026-07-18T11:00:00Z", "2026-08-05T08:00:00Z"],
  ["INSERT OR IGNORE INTO injury_episodes (id, athlete_id, lead_practitioner_id, title, diagnosis_status, body_area, laterality, onset_date, mechanism, severity, participation_status, stage, next_action, review_date, expected_return_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "inj-3", "ath-4", "pr-lina", "Swimmer's shoulder overload", "Suspected", "Shoulder", "Left", "2026-08-02", "High-volume swim block", "Mild", "Under Treatment", "Under Treatment", "Reassess pain response after reduced pull volume", "2026-08-05", "2026-08-11", "2026-08-02T07:00:00Z", "2026-08-04T08:22:00Z"],
  ["INSERT OR IGNORE INTO injury_episodes (id, athlete_id, lead_practitioner_id, title, diagnosis_status, body_area, laterality, onset_date, mechanism, severity, participation_status, stage, next_action, review_date, expected_return_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "inj-4", "ath-7", "pr-omar", "Left ankle sprain", "Suspected", "Ankle", "Left", "2026-08-03", "Landing from block start", "Mild", "Modified Training", "Under Assessment", "Complete swelling and functional loading review", "2026-08-06", "2026-08-15", "2026-08-03T06:45:00Z", "2026-08-03T06:45:00Z"],
  ["INSERT OR IGNORE INTO injury_status_history (id, injury_id, from_stage, to_stage, note, changed_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", "history-1", "inj-1", null, "New", "Episode opened after track-side assessment.", "user-omar", "2026-07-22T08:30:00Z"],
  ["INSERT OR IGNORE INTO injury_status_history (id, injury_id, from_stage, to_stage, note, changed_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", "history-2", "inj-1", "New", "Under Treatment", "Loading plan agreed with sports medicine and performance staff.", "user-omar", "2026-07-23T09:15:00Z"],
  ["INSERT OR IGNORE INTO injury_status_history (id, injury_id, from_stage, to_stage, note, changed_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", "history-3", "inj-2", null, "Under Treatment", "Episode confirmed following clinical review.", "user-lina", "2026-07-18T11:00:00Z"],
  ["INSERT OR IGNORE INTO injury_status_history (id, injury_id, from_stage, to_stage, note, changed_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", "history-4", "inj-2", "Under Treatment", "Return-to-Sport Review", "Functional criteria met; competition simulation remains.", "user-lina", "2026-08-05T08:00:00Z"],
  ["INSERT OR IGNORE INTO injury_status_history (id, injury_id, from_stage, to_stage, note, changed_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", "history-5", "inj-3", null, "Under Treatment", "Training volume modified while response is monitored.", "user-lina", "2026-08-02T07:00:00Z"],
  ["INSERT OR IGNORE INTO injury_status_history (id, injury_id, from_stage, to_stage, note, changed_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", "history-6", "inj-4", null, "Under Assessment", "Episode opened; functional assessment scheduled.", "user-omar", "2026-08-03T06:45:00Z"],
  ["INSERT OR IGNORE INTO injury_encounters (injury_id, encounter_id) VALUES (?, ?)", "inj-1", "enc-1"],
  ["INSERT OR IGNORE INTO injury_encounters (injury_id, encounter_id) VALUES (?, ?)", "inj-1", "enc-9"],
  ["INSERT OR IGNORE INTO injury_encounters (injury_id, encounter_id) VALUES (?, ?)", "inj-2", "enc-3"],
  ["INSERT OR IGNORE INTO injury_encounters (injury_id, encounter_id) VALUES (?, ?)", "inj-3", "enc-2"],
];

const rehabilitationSeedStatements = [
  ["INSERT OR IGNORE INTO rehabilitation_plans (id, injury_id, owner_practitioner_id, title, status, start_date, target_date, current_phase, overall_progress, weekly_frequency, primary_goal, precautions, next_review_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "rehab-1", "inj-1", "pr-omar", "Hamstring return-to-speed pathway", "Active", "2026-07-23", "2026-08-18", 2, 58, "4 sessions / week", "Restore full-speed running exposure and repeated sprint tolerance", "No sprinting above 90% until two symptom-free field sessions", "2026-08-07", "2026-07-23T09:15:00Z", "2026-08-04T10:05:00Z"],
  ["INSERT OR IGNORE INTO rehabilitation_plans (id, injury_id, owner_practitioner_id, title, status, start_date, target_date, current_phase, overall_progress, weekly_frequency, primary_goal, precautions, next_review_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "rehab-2", "inj-2", "pr-omar", "Propulsion load return pathway", "Active", "2026-07-19", "2026-08-12", 4, 82, "3 sessions / week", "Restore competition-volume propulsion with stable shoulder response", "Monitor next-morning pain and reduce volume if pain exceeds 3/10", "2026-08-06", "2026-07-19T08:00:00Z", "2026-08-05T08:00:00Z"],
  ["INSERT OR IGNORE INTO rehabilitation_plans (id, injury_id, owner_practitioner_id, title, status, start_date, target_date, current_phase, overall_progress, weekly_frequency, primary_goal, precautions, next_review_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "rehab-3", "inj-3", "pr-lina", "Shoulder load restoration", "Active", "2026-08-02", "2026-08-11", 1, 34, "Daily activation + 3 loading sessions", "Restore pain-free swim-specific shoulder capacity", "Keep pull volume below 60% until end-range pain settles", "2026-08-05", "2026-08-02T07:00:00Z", "2026-08-04T08:22:00Z"],
  ["INSERT OR IGNORE INTO rehabilitation_phases (id, plan_id, phase_number, title, status, goals, entry_criteria, exit_criteria, progress, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "phase-1-1", "rehab-1", 1, "Settle & restore", "Complete", "Control symptoms and restore comfortable range", "Clinical diagnosis confirmed", "Pain no more than 2/10 with daily activity", 100, "2026-07-23T09:15:00Z", "2026-07-27T09:00:00Z"],
  ["INSERT OR IGNORE INTO rehabilitation_phases (id, plan_id, phase_number, title, status, goals, entry_criteria, exit_criteria, progress, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "phase-1-2", "rehab-1", 2, "Build capacity", "Active", "Restore posterior-chain strength and high-load tolerance", "Daily activity pain controlled", "Isometric strength asymmetry below 10% and pain-free running at 80%", 65, "2026-07-27T09:00:00Z"],
  ["INSERT OR IGNORE INTO rehabilitation_phases (id, plan_id, phase_number, title, status, goals, entry_criteria, exit_criteria, progress) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", "phase-1-3", "rehab-1", 3, "Return to run", "Locked", "Rebuild progressive field running volume", "Strength and 80% running criteria met", "Two symptom-free running sessions above 90%", 0],
  ["INSERT OR IGNORE INTO rehabilitation_phases (id, plan_id, phase_number, title, status, goals, entry_criteria, exit_criteria, progress) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", "phase-1-4", "rehab-1", 4, "Return to speed", "Locked", "Restore repeated sprint and competition readiness", "Two symptom-free high-speed sessions", "Full training exposure and shared RTS approval", 0],
  ["INSERT OR IGNORE INTO rehabilitation_phases (id, plan_id, phase_number, title, status, goals, entry_criteria, exit_criteria, progress, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "phase-2-1", "rehab-2", 1, "Settle symptoms", "Complete", "Reduce reactive shoulder pain", "Episode opened", "Pain controlled at rest and during daily propulsion", 100, "2026-07-19T08:00:00Z", "2026-07-22T08:00:00Z"],
  ["INSERT OR IGNORE INTO rehabilitation_phases (id, plan_id, phase_number, title, status, goals, entry_criteria, exit_criteria, progress, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "phase-2-2", "rehab-2", 2, "Restore capacity", "Complete", "Rebuild scapular and rotator-cuff capacity", "Symptoms stable", "Strength endurance within 10% of baseline", 100, "2026-07-22T08:00:00Z", "2026-07-29T08:00:00Z"],
  ["INSERT OR IGNORE INTO rehabilitation_phases (id, plan_id, phase_number, title, status, goals, entry_criteria, exit_criteria, progress, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "phase-2-3", "rehab-2", 3, "Sport loading", "Complete", "Build propulsion volume and race-pace tolerance", "Strength criteria met", "Two stable race-pace sessions", 100, "2026-07-29T08:00:00Z", "2026-08-04T08:00:00Z"],
  ["INSERT OR IGNORE INTO rehabilitation_phases (id, plan_id, phase_number, title, status, goals, entry_criteria, exit_criteria, progress, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "phase-2-4", "rehab-2", 4, "Competition simulation", "Active", "Confirm race readiness under competition load", "Race-pace criteria met", "Simulation completed with stable 24-hour response", 85, "2026-08-04T08:00:00Z"],
  ["INSERT OR IGNORE INTO rehabilitation_phases (id, plan_id, phase_number, title, status, goals, entry_criteria, exit_criteria, progress, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "phase-3-1", "rehab-3", 1, "Calm & activate", "Active", "Settle end-range pain and restore cuff activation", "Medical review completed", "Pain-free activation and full comfortable range", 55, "2026-08-02T07:00:00Z"],
  ["INSERT OR IGNORE INTO rehabilitation_phases (id, plan_id, phase_number, title, status, goals, entry_criteria, exit_criteria, progress) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", "phase-3-2", "rehab-3", 2, "Build swim capacity", "Locked", "Progress shoulder endurance under swim-specific load", "Full comfortable range", "Stable response to 80% pull volume", 0],
  ["INSERT OR IGNORE INTO rehabilitation_phases (id, plan_id, phase_number, title, status, goals, entry_criteria, exit_criteria, progress) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", "phase-3-3", "rehab-3", 3, "Return to full pool", "Locked", "Restore full training availability", "80% pull volume stable", "Two full sessions without symptom increase", 0],
  ["INSERT OR IGNORE INTO rehabilitation_exercises (id, phase_id, name, dosage, target, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)", "exercise-1", "phase-1-2", "Long-lever hamstring bridge", "4 × 8", "Controlled 3-second eccentric", "Active", 1],
  ["INSERT OR IGNORE INTO rehabilitation_exercises (id, phase_id, name, dosage, target, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)", "exercise-2", "phase-1-2", "Romanian deadlift", "4 × 6", "RPE 7 with symmetrical loading", "Active", 2],
  ["INSERT OR IGNORE INTO rehabilitation_exercises (id, phase_id, name, dosage, target, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)", "exercise-3", "phase-1-2", "Tempo run exposure", "6 × 80 m", "80% speed, pain no more than 2/10", "Active", 3],
  ["INSERT OR IGNORE INTO rehabilitation_exercises (id, phase_id, name, dosage, target, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)", "exercise-4", "phase-2-4", "Race-pace propulsion intervals", "5 × 3 min", "Competition cadence, stable technique", "Active", 1],
  ["INSERT OR IGNORE INTO rehabilitation_exercises (id, phase_id, name, dosage, target, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)", "exercise-5", "phase-2-4", "Competition simulation", "1 full protocol", "No symptom increase at 24 hours", "Active", 2],
  ["INSERT OR IGNORE INTO rehabilitation_exercises (id, phase_id, name, dosage, target, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)", "exercise-6", "phase-3-1", "Isometric external rotation", "5 × 30 sec", "Pain-free at 60% effort", "Active", 1],
  ["INSERT OR IGNORE INTO rehabilitation_exercises (id, phase_id, name, dosage, target, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)", "exercise-7", "phase-3-1", "Serratus wall slide", "3 × 10", "Smooth upward rotation", "Active", 2],
  ["INSERT OR IGNORE INTO rehabilitation_exercises (id, phase_id, name, dosage, target, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)", "exercise-8", "phase-3-1", "Reduced-volume swim", "20 min", "Technique focus below 60% pull volume", "Active", 3],
  ["INSERT OR IGNORE INTO rehabilitation_sessions (id, plan_id, phase_id, practitioner_id, session_date, session_type, status, load_score, pain_pre, pain_post, phase_progress, notes, next_action, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "session-1", "rehab-1", "phase-1-2", "pr-omar", "2026-08-04T09:30:00Z", "Field + gym rehabilitation", "Completed", 7, 1, 1, 65, "Completed strength block and 80% tempo exposure without symptom increase.", "Repeat field exposure before progressing speed.", "2026-08-04T10:05:00Z"],
  ["INSERT OR IGNORE INTO rehabilitation_sessions (id, plan_id, phase_id, practitioner_id, session_date, session_type, status, notes, next_action) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", "session-2", "rehab-1", "phase-1-2", "pr-omar", "2026-08-06T08:30:00Z", "Field rehabilitation", "Scheduled", "", "Review response before phase decision."],
  ["INSERT OR IGNORE INTO rehabilitation_sessions (id, plan_id, phase_id, practitioner_id, session_date, session_type, status, load_score, pain_pre, pain_post, phase_progress, notes, next_action, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "session-3", "rehab-2", "phase-2-4", "pr-omar", "2026-08-04T11:00:00Z", "Propulsion conditioning", "Completed", 8, 1, 2, 85, "Race-pace intervals completed with stable technique.", "Complete full competition simulation.", "2026-08-04T12:00:00Z"],
  ["INSERT OR IGNORE INTO rehabilitation_sessions (id, plan_id, phase_id, practitioner_id, session_date, session_type, status, notes, next_action) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", "session-4", "rehab-2", "phase-2-4", "pr-omar", "2026-08-06T10:00:00Z", "Competition simulation", "Scheduled", "", "Multidisciplinary review after 24-hour response."],
  ["INSERT OR IGNORE INTO rehabilitation_sessions (id, plan_id, phase_id, practitioner_id, session_date, session_type, status, load_score, pain_pre, pain_post, phase_progress, notes, next_action, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "session-5", "rehab-3", "phase-3-1", "pr-lina", "2026-08-04T07:45:00Z", "Pool-side activation", "Completed", 4, 2, 1, 55, "Activation and reduced-volume swim completed with improved end-range comfort.", "Maintain reduced pull volume and reassess tomorrow.", "2026-08-04T08:22:00Z"],
  ["INSERT OR IGNORE INTO rehabilitation_sessions (id, plan_id, phase_id, practitioner_id, session_date, session_type, status, notes, next_action) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", "session-6", "rehab-3", "phase-3-1", "pr-lina", "2026-08-05T07:30:00Z", "Pool rehabilitation", "Scheduled", "", "Review pain response and range."],
];

const encounterMetadataSeedStatements = [
  ["UPDATE encounters SET clinic_city = ?, clinic_type = ?, clinic_location = ?, diagnosis = ? WHERE id = ?", "Dhahran", "Physiotherapy Clinic", "SOPCare Dhahran Training Center", "Right hamstring strain with improving load tolerance", "enc-1"],
  ["UPDATE encounters SET clinic_city = ?, clinic_type = ?, clinic_location = ?, diagnosis = ? WHERE id = ?", "Riyadh", "Sports Medicine Clinic", "Riyadh High Performance Center", "Training-related left shoulder overload", "enc-2"],
  ["UPDATE encounters SET clinic_city = ?, clinic_type = ?, clinic_location = ?, diagnosis = ? WHERE id = ?", "Riyadh", "Sports Medicine Clinic", "Riyadh High Performance Center", "Right shoulder overload — return-to-sport review pending", "enc-3"],
  ["UPDATE encounters SET clinic_city = ?, clinic_type = ?, clinic_location = ?, diagnosis = ? WHERE id = ?", "Dammam", "Sports Nutrition Clinic", "Dammam National Team Hub", "Competition-week fueling strategy review", "enc-4"],
  ["UPDATE encounters SET clinic_city = ?, clinic_type = ?, clinic_location = ?, diagnosis = ? WHERE id = ?", "Dhahran", "Physiotherapy Clinic", "SOPCare Dhahran Training Center", "Upper-limb load monitoring — asymptomatic", "enc-5"],
  ["UPDATE encounters SET clinic_city = ?, clinic_type = ?, clinic_location = ?, diagnosis = ? WHERE id = ?", "Dammam", "Sports Medicine Clinic", "Dammam National Team Hub", "Travel-related fatigue without medical red flags", "enc-6"],
  ["UPDATE encounters SET clinic_city = ?, clinic_type = ?, clinic_location = ?, diagnosis = ? WHERE id = ?", "Riyadh", "Sports Medicine Clinic", "Riyadh High Performance Center", "Pre-camp screen — medically available", "enc-7"],
  ["UPDATE encounters SET clinic_city = ?, clinic_type = ?, clinic_location = ?, diagnosis = ? WHERE id = ?", "Riyadh", "Sports Nutrition Clinic", "Riyadh High Performance Center", "Suboptimal post-session recovery intake", "enc-8"],
  ["UPDATE encounters SET clinic_city = ?, clinic_type = ?, clinic_location = ?, diagnosis = ? WHERE id = ?", "Riyadh", "Sports Medicine Clinic", "Riyadh High Performance Center", "Right hamstring strain — stable improvement", "enc-9"],
  ["UPDATE encounters SET clinic_city = ?, clinic_type = ?, clinic_location = ?, diagnosis = ? WHERE id = ?", "Dhahran", "Sports Psychology Clinic", "SOPCare Dhahran Training Center", "Restricted performance psychology formulation", "enc-10"],
];

export function getD1() {
  return getPostgres();
}

function rosterId(value: string) {
  return `sotc-sport-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}

async function ensureSotcRoster(db: ReturnType<typeof getD1>) {
  const roster = await getSotcAthletes();
  const imported = await db.prepare("SELECT COUNT(*) AS count FROM athletes WHERE mrn LIKE 'SOTC-%'").first<{ count: number }>();
  if ((imported?.count ?? 0) < roster.length) {

  const existingSports = await db.prepare("SELECT id, name FROM sports").all<{ id: string; name: string }>();
  const sportIds = new Map(existingSports.results.map((sport) => [sport.name, sport.id]));
  const requestedSports = [...new Set(roster.map(([, sport]) => sport))];
  const missingSports = requestedSports.filter((sport) => !sportIds.has(sport));
  if (missingSports.length) {
    await db.batch(missingSports.map((sport) => db.prepare("INSERT INTO sports (id, name) VALUES (?, ?) ON CONFLICT (name) DO NOTHING").bind(rosterId(sport), sport)));
  }
  const resolvedSports = await db.prepare("SELECT id, name FROM sports").all<{ id: string; name: string }>();
  const resolvedSportIds = new Map(resolvedSports.results.map((sport) => [sport.name, sport.id]));
  const accents = ["#006C46", "#397F91", "#6A5E8C", "#B1854F", "#2F765F", "#A45D65"];
  const statements = roster.map(([name, sport, suppliedDiscipline], index) => {
    const words = name.trim().split(/\s+/);
    const firstName = words.shift() || name;
    const lastName = words.join(" ") || "—";
    return db.prepare(`INSERT INTO athletes (id, mrn, first_name, last_name, date_of_birth, sex, sport_id, discipline, dominant_side, status, medical_alerts, emergency_contact, accent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (mrn) DO NOTHING`)
      .bind(`sotc-ath-${String(index + 1).padStart(3, "0")}`, `SOTC-${String(index + 1).padStart(3, "0")}`, firstName, lastName, "", "Not recorded", resolvedSportIds.get(sport), suppliedDiscipline || "Not recorded", "Not recorded", "Available", "None recorded", "Not recorded", accents[index % accents.length]);
  });
    for (let start = 0; start < statements.length; start += 50) await db.batch(statements.slice(start, start + 50));
  }

  const birthdateImportId = "sotc-birthdates-2026-08-15";
  const birthdatesImported = await db.prepare("SELECT id FROM report_settings WHERE id = ?").bind(birthdateImportId).first<{ id: string }>();
  if (!birthdatesImported) {
    const birthdateByName = new Map(await getSotcBirthdates());
    const updates = roster.map(([name], index) => db.prepare("UPDATE athletes SET date_of_birth = ?, updated_at = CURRENT_TIMESTAMP::text WHERE mrn = ?")
      .bind(birthdateByName.get(name) ?? "", `SOTC-${String(index + 1).padStart(3, "0")}`));
    for (let start = 0; start < updates.length; start += 50) await db.batch(updates.slice(start, start + 50));
    await db.prepare("INSERT INTO report_settings (id, settings_json, updated_by, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP::text)")
      .bind(birthdateImportId, JSON.stringify({ athleteCount: roster.length }), "system-import").run();
  }
}

let databaseInitialization: Promise<void> | null = null;

async function initializeDatabase(db: ReturnType<typeof getD1>) {
  await db.prepare("SELECT 1").run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS rehabilitation_measurements (
    id text PRIMARY KEY,
    session_id text NOT NULL REFERENCES rehabilitation_sessions(id),
    plan_id text NOT NULL REFERENCES rehabilitation_plans(id),
    metric_type text NOT NULL,
    label text NOT NULL,
    numeric_value double precision,
    text_value text NOT NULL DEFAULT '',
    unit text NOT NULL DEFAULT '',
    context text NOT NULL DEFAULT '',
    recorded_at text NOT NULL,
    created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
    updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP::text
  )`).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_rehab_measurements_plan_date ON rehabilitation_measurements (plan_id, recorded_at)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_rehab_measurements_session ON rehabilitation_measurements (session_id)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_rehab_measurements_plan_metric ON rehabilitation_measurements (plan_id, metric_type, recorded_at)").run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS portal_users (
    id text PRIMARY KEY,
    username text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    email text NOT NULL UNIQUE,
    full_name text NOT NULL,
    phone_number text NOT NULL DEFAULT '',
    professional_role_id text NOT NULL,
    professional_role text NOT NULL,
    clinic_city text NOT NULL DEFAULT 'Riyadh',
    job_title text NOT NULL DEFAULT '',
    department text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'Active',
    workspace_ids text NOT NULL DEFAULT '[]',
    role_ids text NOT NULL DEFAULT '[]',
    permission_ids text NOT NULL DEFAULT '[]',
    permission_overrides text NOT NULL DEFAULT '{"grant":[],"revoke":[]}',
    last_active text NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
    created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
    updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP::text
  )`).run();
  await db.prepare("ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS clinic_city text NOT NULL DEFAULT 'Riyadh'").run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS user_directory_overrides (
    user_id text PRIMARY KEY,
    professional_role_id text NOT NULL,
    professional_role text NOT NULL,
    clinic_city text NOT NULL,
    phone_number text NOT NULL DEFAULT '',
    job_title text NOT NULL DEFAULT '',
    department text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'Active',
    workspace_ids text NOT NULL DEFAULT '[]',
    updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP::text
  )`).run();
  await db.prepare("ALTER TABLE user_directory_overrides ADD COLUMN IF NOT EXISTS phone_number text NOT NULL DEFAULT ''").run();
  await db.prepare("ALTER TABLE user_directory_overrides ADD COLUMN IF NOT EXISTS role_ids text NOT NULL DEFAULT '[]'").run();
  await db.prepare("ALTER TABLE user_directory_overrides ADD COLUMN IF NOT EXISTS permission_overrides text NOT NULL DEFAULT '{\"grant\":[],\"revoke\":[]}'").run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS access_role_configs (
    id text PRIMARY KEY,
    name text NOT NULL UNIQUE,
    description text NOT NULL DEFAULT '',
    permission_ids text NOT NULL DEFAULT '[]',
    created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
    updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP::text
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS professional_role_configs (
    id text PRIMARY KEY,
    name text NOT NULL UNIQUE,
    description text NOT NULL DEFAULT '',
    active integer NOT NULL DEFAULT 1,
    created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
    updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP::text
  )`).run();
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO access_role_configs (id, name, description, permission_ids) VALUES (?, ?, ?, ?)").bind("role-admin", "System Administrator", "Full SOPCare administration and clinical access.", JSON.stringify(["athletes.view","athletes.create","athletes.edit","athletes.delete","clinical.records.view","clinical.notes.create","clinical.notes.edit","admin.users.manage","admin.professional_roles.manage","admin.permissions.manage","admin.audit.view","admin.settings.manage"])),
    db.prepare("INSERT OR IGNORE INTO access_role_configs (id, name, description, permission_ids) VALUES (?, ?, ?, ?)").bind("role-clinician", "Clinical Practitioner", "Standard multidisciplinary clinical access.", JSON.stringify(["athletes.view","clinical.records.view","clinical.notes.create","clinical.notes.edit"])),
    db.prepare("INSERT OR IGNORE INTO access_role_configs (id, name, description, permission_ids) VALUES (?, ?, ?, ?)").bind("role-readonly", "Clinical Viewer", "Read-only athlete and medical record access.", JSON.stringify(["athletes.view","clinical.records.view"])),
    db.prepare("INSERT OR IGNORE INTO professional_role_configs (id, name, description, active) VALUES (?, ?, ?, 1)").bind("pr-sports-medicine", "Sports Medicine Physician", "Sports medicine assessment, diagnosis, and return-to-sport care."),
    db.prepare("INSERT OR IGNORE INTO professional_role_configs (id, name, description, active) VALUES (?, ?, ?, 1)").bind("pr-family", "Family Physician", "Primary and family medicine within athlete care."),
    db.prepare("INSERT OR IGNORE INTO professional_role_configs (id, name, description, active) VALUES (?, ?, ?, 1)").bind("pr-physio", "Physiotherapist", "Rehabilitation, function, and movement care."),
    db.prepare("INSERT OR IGNORE INTO professional_role_configs (id, name, description, active) VALUES (?, ?, ?, 1)").bind("pr-nutrition", "Sports Nutritionist", "Performance nutrition and athlete wellbeing."),
    db.prepare("INSERT OR IGNORE INTO professional_role_configs (id, name, description, active) VALUES (?, ?, ?, 1)").bind("pr-psychology", "Sports Psychologist", "Mental health and performance psychology."),
    db.prepare("INSERT OR IGNORE INTO professional_role_configs (id, name, description, active) VALUES (?, ?, ?, 1)").bind("pr-performance", "Performance Therapist", "Integrated performance therapy and recovery.")
  ]);
  await db.prepare(`CREATE TABLE IF NOT EXISTS report_settings (
    id text PRIMARY KEY,
    settings_json text NOT NULL DEFAULT '{}',
    updated_by text NOT NULL DEFAULT '',
    updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP::text
  )`).run();
  // Import the supplied athlete roster once. The import is idempotent, so a
  // partial first run is safely completed on the next workspace load.
  await ensureSotcRoster(db);

  const runtime = env as unknown as {
    APP_ENV?: string;
    SOPCARE_ENABLE_DEV_SEED?: string;
  };
  const seedEnabled =
    runtime.APP_ENV === "development" &&
    runtime.SOPCARE_ENABLE_DEV_SEED === "true";

  if (!seedEnabled) return;

  const count = await db.prepare("SELECT COUNT(*) AS count FROM athletes").first<{ count: number }>();
  if ((count?.count ?? 0) === 0) {
    await db.batch(seedStatements.map(([statement, ...values]) => db.prepare(String(statement)).bind(...values)));
  }
  const injuryCount = await db.prepare("SELECT COUNT(*) AS count FROM injury_episodes").first<{ count: number }>();
  if ((injuryCount?.count ?? 0) === 0) {
    await db.batch(injurySeedStatements.map(([statement, ...values]) => db.prepare(String(statement)).bind(...values)));
  }
  const rehabilitationCount = await db.prepare("SELECT COUNT(*) AS count FROM rehabilitation_plans").first<{ count: number }>();
  if ((rehabilitationCount?.count ?? 0) === 0) {
    await db.batch(rehabilitationSeedStatements.map(([statement, ...values]) => db.prepare(String(statement)).bind(...values)));
  }
  const encounterMetadataCount = await db.prepare("SELECT COUNT(*) AS count FROM encounters WHERE diagnosis != ''").first<{ count: number }>();
  if ((encounterMetadataCount?.count ?? 0) === 0) {
    await db.batch(encounterMetadataSeedStatements.map(([statement, ...values]) => db.prepare(String(statement)).bind(...values)));
  }
}

export async function ensureDatabase() {
  const db = getD1();
  if (!databaseInitialization) {
    databaseInitialization = initializeDatabase(db).catch((error) => {
      databaseInitialization = null;
      throw error;
    });
  }
  await databaseInitialization;
  return db;
}

export async function writeAudit(actorId: string, action: string, entityType: string, entityId: string, summary: string) {
  const db = getD1();
  await db.prepare("INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, summary) VALUES (?, ?, ?, ?, ?)")
    .bind(actorId, action, entityType, entityId, summary)
    .run();
}
