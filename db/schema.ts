import { sql } from "drizzle-orm";
import { index, integer, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP::text`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP::text`),
};

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  active: integer("active").notNull().default(1),
  ...timestamps,
}, (table) => [uniqueIndex("idx_users_email").on(table.email)]);

export const practitionerProfiles = pgTable("practitioner_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  specialty: text("specialty").notNull(),
  credentials: text("credentials"),
  defaultEncounterType: text("default_encounter_type").notNull().default("Medical Review"),
  clinicCity: text("clinic_city").notNull().default("Riyadh"),
  clinicType: text("clinic_type").notNull().default("Sports Medicine Clinic"),
  clinicLocation: text("clinic_location").notNull().default("SOPCare Performance Center"),
  ...timestamps,
}, (table) => [uniqueIndex("idx_practitioner_profiles_user_id").on(table.userId)]);

export const roles = pgTable("roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("idx_roles_name").on(table.name)]);

export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  roleId: text("role_id").notNull().references(() => roles.id),
  ...timestamps,
}, (table) => [uniqueIndex("idx_user_roles_pair").on(table.userId, table.roleId)]);

export const sports = pgTable("sports", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("idx_sports_name").on(table.name)]);

export const teams = pgTable("teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("idx_teams_name").on(table.name)]);

export const athletes = pgTable("athletes", {
  id: text("id").primaryKey(),
  mrn: text("mrn").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  sex: text("sex").notNull(),
  nationality: text("nationality").notNull().default("Saudi Arabia"),
  sportId: text("sport_id").notNull().references(() => sports.id),
  discipline: text("discipline").notNull(),
  dominantSide: text("dominant_side").notNull(),
  status: text("status").notNull().default("Available"),
  medicalAlerts: text("medical_alerts").notNull().default("None recorded"),
  allergies: text("allergies").notNull().default("None recorded"),
  chronicConditions: text("chronic_conditions").notNull().default("None recorded"),
  prohibitedMedications: text("prohibited_medications").notNull().default("None recorded"),
  emergencyContact: text("emergency_contact").notNull().default("Not provided"),
  followUpDate: text("follow_up_date"),
  accent: text("accent").notNull().default("#006C46"),
  ...timestamps,
}, (table) => [
  uniqueIndex("idx_athletes_mrn").on(table.mrn),
  index("idx_athletes_name").on(table.lastName, table.firstName),
  index("idx_athletes_status").on(table.status),
  index("idx_athletes_sport_id").on(table.sportId),
]);

export const athleteTeamMemberships = pgTable("athlete_team_memberships", {
  id: serial("id").primaryKey(),
  athleteId: text("athlete_id").notNull().references(() => athletes.id),
  teamId: text("team_id").notNull().references(() => teams.id),
  isPrimary: integer("is_primary").notNull().default(1),
  ...timestamps,
}, (table) => [index("idx_memberships_athlete_id").on(table.athleteId)]);

export const athleteCareTeam = pgTable("athlete_care_team", {
  id: serial("id").primaryKey(),
  athleteId: text("athlete_id").notNull().references(() => athletes.id),
  practitionerId: text("practitioner_id").notNull().references(() => practitionerProfiles.id),
  isLead: integer("is_lead").notNull().default(0),
  ...timestamps,
}, (table) => [
  uniqueIndex("idx_care_team_pair").on(table.athleteId, table.practitionerId),
  index("idx_care_team_athlete_id").on(table.athleteId),
]);

export const encounters = pgTable("encounters", {
  id: text("id").primaryKey(),
  athleteId: text("athlete_id").notNull().references(() => athletes.id),
  practitionerId: text("practitioner_id").notNull().references(() => practitionerProfiles.id),
  encounterDate: text("encounter_date").notNull(),
  encounterType: text("encounter_type").notNull(),
  clinicCity: text("clinic_city").notNull().default("Riyadh"),
  clinicType: text("clinic_type").notNull().default("Sports Medicine Clinic"),
  clinicLocation: text("clinic_location").notNull().default("SOPCare Performance Center"),
  reason: text("reason").notNull(),
  subjective: text("subjective").notNull().default(""),
  objective: text("objective").notNull().default(""),
  assessment: text("assessment").notNull().default(""),
  plan: text("plan").notNull().default(""),
  diagnosis: text("diagnosis").notNull().default(""),
  visibility: text("visibility").notNull().default("Care team"),
  followUpDate: text("follow_up_date"),
  ...timestamps,
}, (table) => [
  index("idx_encounters_athlete_date").on(table.athleteId, table.encounterDate),
  index("idx_encounters_practitioner_id").on(table.practitionerId),
]);

export const encounterAmendments = pgTable("encounter_amendments", {
  id: text("id").primaryKey(),
  encounterId: text("encounter_id").notNull().references(() => encounters.id),
  practitionerId: text("practitioner_id").notNull().references(() => practitionerProfiles.id),
  reason: text("reason").notNull(),
  content: text("content").notNull(),
  ...timestamps,
}, (table) => [index("idx_amendments_encounter_id").on(table.encounterId)]);

export const injuryEpisodes = pgTable("injury_episodes", {
  id: text("id").primaryKey(),
  athleteId: text("athlete_id").notNull().references(() => athletes.id),
  leadPractitionerId: text("lead_practitioner_id").notNull().references(() => practitionerProfiles.id),
  title: text("title").notNull(),
  diagnosisStatus: text("diagnosis_status").notNull().default("Suspected"),
  bodyArea: text("body_area").notNull(),
  laterality: text("laterality").notNull().default("Not applicable"),
  onsetDate: text("onset_date").notNull(),
  mechanism: text("mechanism").notNull(),
  severity: text("severity").notNull().default("Moderate"),
  participationStatus: text("participation_status").notNull().default("Modified Training"),
  stage: text("stage").notNull().default("New"),
  nextAction: text("next_action").notNull(),
  reviewDate: text("review_date"),
  expectedReturnDate: text("expected_return_date"),
  closureSummary: text("closure_summary"),
  closedAt: text("closed_at"),
  ...timestamps,
}, (table) => [
  index("idx_injuries_athlete_stage").on(table.athleteId, table.stage),
  index("idx_injuries_stage_review").on(table.stage, table.reviewDate),
  index("idx_injuries_lead_practitioner").on(table.leadPractitionerId),
]);

export const injuryStatusHistory = pgTable("injury_status_history", {
  id: text("id").primaryKey(),
  injuryId: text("injury_id").notNull().references(() => injuryEpisodes.id),
  fromStage: text("from_stage"),
  toStage: text("to_stage").notNull(),
  note: text("note").notNull(),
  changedBy: text("changed_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP::text`),
}, (table) => [index("idx_injury_history_injury_date").on(table.injuryId, table.createdAt)]);

export const injuryEncounters = pgTable("injury_encounters", {
  id: serial("id").primaryKey(),
  injuryId: text("injury_id").notNull().references(() => injuryEpisodes.id),
  encounterId: text("encounter_id").notNull().references(() => encounters.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP::text`),
}, (table) => [
  uniqueIndex("idx_injury_encounter_pair").on(table.injuryId, table.encounterId),
  index("idx_injury_encounters_injury").on(table.injuryId),
]);

export const rehabilitationPlans = pgTable("rehabilitation_plans", {
  id: text("id").primaryKey(),
  injuryId: text("injury_id").notNull().references(() => injuryEpisodes.id),
  ownerPractitionerId: text("owner_practitioner_id").notNull().references(() => practitionerProfiles.id),
  title: text("title").notNull(),
  status: text("status").notNull().default("Active"),
  startDate: text("start_date").notNull(),
  targetDate: text("target_date"),
  currentPhase: integer("current_phase").notNull().default(1),
  overallProgress: integer("overall_progress").notNull().default(0),
  weeklyFrequency: text("weekly_frequency").notNull(),
  primaryGoal: text("primary_goal").notNull(),
  precautions: text("precautions").notNull().default("None recorded"),
  nextReviewDate: text("next_review_date"),
  ...timestamps,
}, (table) => [
  index("idx_rehab_plans_injury_status").on(table.injuryId, table.status),
  index("idx_rehab_plans_status_review").on(table.status, table.nextReviewDate),
  index("idx_rehab_plans_owner").on(table.ownerPractitionerId),
]);

export const rehabilitationPhases = pgTable("rehabilitation_phases", {
  id: text("id").primaryKey(),
  planId: text("plan_id").notNull().references(() => rehabilitationPlans.id),
  phaseNumber: integer("phase_number").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("Locked"),
  goals: text("goals").notNull(),
  entryCriteria: text("entry_criteria").notNull(),
  exitCriteria: text("exit_criteria").notNull(),
  progress: integer("progress").notNull().default(0),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  ...timestamps,
}, (table) => [
  uniqueIndex("idx_rehab_phase_plan_number").on(table.planId, table.phaseNumber),
  index("idx_rehab_phase_plan_status").on(table.planId, table.status),
]);

export const rehabilitationExercises = pgTable("rehabilitation_exercises", {
  id: text("id").primaryKey(),
  phaseId: text("phase_id").notNull().references(() => rehabilitationPhases.id),
  name: text("name").notNull(),
  dosage: text("dosage").notNull(),
  target: text("target").notNull(),
  status: text("status").notNull().default("Active"),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
}, (table) => [index("idx_rehab_exercises_phase_order").on(table.phaseId, table.sortOrder)]);

export const rehabilitationSessions = pgTable("rehabilitation_sessions", {
  id: text("id").primaryKey(),
  planId: text("plan_id").notNull().references(() => rehabilitationPlans.id),
  phaseId: text("phase_id").notNull().references(() => rehabilitationPhases.id),
  practitionerId: text("practitioner_id").notNull().references(() => practitionerProfiles.id),
  sessionDate: text("session_date").notNull(),
  sessionType: text("session_type").notNull(),
  status: text("status").notNull().default("Scheduled"),
  loadScore: integer("load_score"),
  painPre: integer("pain_pre"),
  painPost: integer("pain_post"),
  phaseProgress: integer("phase_progress"),
  notes: text("notes").notNull().default(""),
  nextAction: text("next_action").notNull().default(""),
  completedAt: text("completed_at"),
  ...timestamps,
}, (table) => [
  index("idx_rehab_sessions_plan_date").on(table.planId, table.sessionDate),
  index("idx_rehab_sessions_phase_date").on(table.phaseId, table.sessionDate),
]);

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  summary: text("summary").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP::text`),
}, (table) => [
  index("idx_audit_entity").on(table.entityType, table.entityId),
  index("idx_audit_created_at").on(table.createdAt),
]);
