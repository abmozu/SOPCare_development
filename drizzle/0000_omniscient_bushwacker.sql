CREATE TABLE "athlete_care_team" (
	"id" serial PRIMARY KEY NOT NULL,
	"athlete_id" text NOT NULL,
	"practitioner_id" text NOT NULL,
	"is_lead" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "athlete_team_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"athlete_id" text NOT NULL,
	"team_id" text NOT NULL,
	"is_primary" integer DEFAULT 1 NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "athletes" (
	"id" text PRIMARY KEY NOT NULL,
	"mrn" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"date_of_birth" text NOT NULL,
	"sex" text NOT NULL,
	"nationality" text DEFAULT 'Saudi Arabia' NOT NULL,
	"sport_id" text NOT NULL,
	"discipline" text NOT NULL,
	"dominant_side" text NOT NULL,
	"status" text DEFAULT 'Available' NOT NULL,
	"medical_alerts" text DEFAULT 'None recorded' NOT NULL,
	"emergency_contact" text DEFAULT 'Not provided' NOT NULL,
	"follow_up_date" text,
	"accent" text DEFAULT '#006C46' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"summary" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "encounter_amendments" (
	"id" text PRIMARY KEY NOT NULL,
	"encounter_id" text NOT NULL,
	"practitioner_id" text NOT NULL,
	"reason" text NOT NULL,
	"content" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "encounters" (
	"id" text PRIMARY KEY NOT NULL,
	"athlete_id" text NOT NULL,
	"practitioner_id" text NOT NULL,
	"encounter_date" text NOT NULL,
	"encounter_type" text NOT NULL,
	"clinic_city" text DEFAULT 'Riyadh' NOT NULL,
	"clinic_type" text DEFAULT 'Sports Medicine Clinic' NOT NULL,
	"clinic_location" text DEFAULT 'SOPCare Performance Center' NOT NULL,
	"reason" text NOT NULL,
	"subjective" text DEFAULT '' NOT NULL,
	"objective" text DEFAULT '' NOT NULL,
	"assessment" text DEFAULT '' NOT NULL,
	"plan" text DEFAULT '' NOT NULL,
	"diagnosis" text DEFAULT '' NOT NULL,
	"visibility" text DEFAULT 'Care team' NOT NULL,
	"follow_up_date" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "injury_encounters" (
	"id" serial PRIMARY KEY NOT NULL,
	"injury_id" text NOT NULL,
	"encounter_id" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "injury_episodes" (
	"id" text PRIMARY KEY NOT NULL,
	"athlete_id" text NOT NULL,
	"lead_practitioner_id" text NOT NULL,
	"title" text NOT NULL,
	"diagnosis_status" text DEFAULT 'Suspected' NOT NULL,
	"body_area" text NOT NULL,
	"laterality" text DEFAULT 'Not applicable' NOT NULL,
	"onset_date" text NOT NULL,
	"mechanism" text NOT NULL,
	"severity" text DEFAULT 'Moderate' NOT NULL,
	"participation_status" text DEFAULT 'Modified Training' NOT NULL,
	"stage" text DEFAULT 'New' NOT NULL,
	"next_action" text NOT NULL,
	"review_date" text,
	"expected_return_date" text,
	"closure_summary" text,
	"closed_at" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "injury_status_history" (
	"id" text PRIMARY KEY NOT NULL,
	"injury_id" text NOT NULL,
	"from_stage" text,
	"to_stage" text NOT NULL,
	"note" text NOT NULL,
	"changed_by" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practitioner_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"specialty" text NOT NULL,
	"credentials" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rehabilitation_exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"phase_id" text NOT NULL,
	"name" text NOT NULL,
	"dosage" text NOT NULL,
	"target" text NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rehabilitation_phases" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"phase_number" integer NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'Locked' NOT NULL,
	"goals" text NOT NULL,
	"entry_criteria" text NOT NULL,
	"exit_criteria" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"started_at" text,
	"completed_at" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rehabilitation_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"injury_id" text NOT NULL,
	"owner_practitioner_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"start_date" text NOT NULL,
	"target_date" text,
	"current_phase" integer DEFAULT 1 NOT NULL,
	"overall_progress" integer DEFAULT 0 NOT NULL,
	"weekly_frequency" text NOT NULL,
	"primary_goal" text NOT NULL,
	"precautions" text DEFAULT 'None recorded' NOT NULL,
	"next_review_date" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rehabilitation_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"phase_id" text NOT NULL,
	"practitioner_id" text NOT NULL,
	"session_date" text NOT NULL,
	"session_type" text NOT NULL,
	"status" text DEFAULT 'Scheduled' NOT NULL,
	"load_score" integer,
	"pain_pre" integer,
	"pain_post" integer,
	"phase_progress" integer,
	"notes" text DEFAULT '' NOT NULL,
	"next_action" text DEFAULT '' NOT NULL,
	"completed_at" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sports" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role_id" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "athlete_care_team" ADD CONSTRAINT "athlete_care_team_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_care_team" ADD CONSTRAINT "athlete_care_team_practitioner_id_practitioner_profiles_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."practitioner_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_team_memberships" ADD CONSTRAINT "athlete_team_memberships_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_team_memberships" ADD CONSTRAINT "athlete_team_memberships_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athletes" ADD CONSTRAINT "athletes_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounter_amendments" ADD CONSTRAINT "encounter_amendments_encounter_id_encounters_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounter_amendments" ADD CONSTRAINT "encounter_amendments_practitioner_id_practitioner_profiles_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."practitioner_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_practitioner_id_practitioner_profiles_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."practitioner_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury_encounters" ADD CONSTRAINT "injury_encounters_injury_id_injury_episodes_id_fk" FOREIGN KEY ("injury_id") REFERENCES "public"."injury_episodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury_encounters" ADD CONSTRAINT "injury_encounters_encounter_id_encounters_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury_episodes" ADD CONSTRAINT "injury_episodes_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury_episodes" ADD CONSTRAINT "injury_episodes_lead_practitioner_id_practitioner_profiles_id_fk" FOREIGN KEY ("lead_practitioner_id") REFERENCES "public"."practitioner_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury_status_history" ADD CONSTRAINT "injury_status_history_injury_id_injury_episodes_id_fk" FOREIGN KEY ("injury_id") REFERENCES "public"."injury_episodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury_status_history" ADD CONSTRAINT "injury_status_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practitioner_profiles" ADD CONSTRAINT "practitioner_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rehabilitation_exercises" ADD CONSTRAINT "rehabilitation_exercises_phase_id_rehabilitation_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."rehabilitation_phases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rehabilitation_phases" ADD CONSTRAINT "rehabilitation_phases_plan_id_rehabilitation_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."rehabilitation_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rehabilitation_plans" ADD CONSTRAINT "rehabilitation_plans_injury_id_injury_episodes_id_fk" FOREIGN KEY ("injury_id") REFERENCES "public"."injury_episodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rehabilitation_plans" ADD CONSTRAINT "rehabilitation_plans_owner_practitioner_id_practitioner_profiles_id_fk" FOREIGN KEY ("owner_practitioner_id") REFERENCES "public"."practitioner_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rehabilitation_sessions" ADD CONSTRAINT "rehabilitation_sessions_plan_id_rehabilitation_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."rehabilitation_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rehabilitation_sessions" ADD CONSTRAINT "rehabilitation_sessions_phase_id_rehabilitation_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."rehabilitation_phases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rehabilitation_sessions" ADD CONSTRAINT "rehabilitation_sessions_practitioner_id_practitioner_profiles_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."practitioner_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_care_team_pair" ON "athlete_care_team" USING btree ("athlete_id","practitioner_id");--> statement-breakpoint
CREATE INDEX "idx_care_team_athlete_id" ON "athlete_care_team" USING btree ("athlete_id");--> statement-breakpoint
CREATE INDEX "idx_memberships_athlete_id" ON "athlete_team_memberships" USING btree ("athlete_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_athletes_mrn" ON "athletes" USING btree ("mrn");--> statement-breakpoint
CREATE INDEX "idx_athletes_name" ON "athletes" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "idx_athletes_status" ON "athletes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_athletes_sport_id" ON "athletes" USING btree ("sport_id");--> statement-breakpoint
CREATE INDEX "idx_audit_entity" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_created_at" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_amendments_encounter_id" ON "encounter_amendments" USING btree ("encounter_id");--> statement-breakpoint
CREATE INDEX "idx_encounters_athlete_date" ON "encounters" USING btree ("athlete_id","encounter_date");--> statement-breakpoint
CREATE INDEX "idx_encounters_practitioner_id" ON "encounters" USING btree ("practitioner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_injury_encounter_pair" ON "injury_encounters" USING btree ("injury_id","encounter_id");--> statement-breakpoint
CREATE INDEX "idx_injury_encounters_injury" ON "injury_encounters" USING btree ("injury_id");--> statement-breakpoint
CREATE INDEX "idx_injuries_athlete_stage" ON "injury_episodes" USING btree ("athlete_id","stage");--> statement-breakpoint
CREATE INDEX "idx_injuries_stage_review" ON "injury_episodes" USING btree ("stage","review_date");--> statement-breakpoint
CREATE INDEX "idx_injuries_lead_practitioner" ON "injury_episodes" USING btree ("lead_practitioner_id");--> statement-breakpoint
CREATE INDEX "idx_injury_history_injury_date" ON "injury_status_history" USING btree ("injury_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_practitioner_profiles_user_id" ON "practitioner_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_rehab_exercises_phase_order" ON "rehabilitation_exercises" USING btree ("phase_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_rehab_phase_plan_number" ON "rehabilitation_phases" USING btree ("plan_id","phase_number");--> statement-breakpoint
CREATE INDEX "idx_rehab_phase_plan_status" ON "rehabilitation_phases" USING btree ("plan_id","status");--> statement-breakpoint
CREATE INDEX "idx_rehab_plans_injury_status" ON "rehabilitation_plans" USING btree ("injury_id","status");--> statement-breakpoint
CREATE INDEX "idx_rehab_plans_status_review" ON "rehabilitation_plans" USING btree ("status","next_review_date");--> statement-breakpoint
CREATE INDEX "idx_rehab_plans_owner" ON "rehabilitation_plans" USING btree ("owner_practitioner_id");--> statement-breakpoint
CREATE INDEX "idx_rehab_sessions_plan_date" ON "rehabilitation_sessions" USING btree ("plan_id","session_date");--> statement-breakpoint
CREATE INDEX "idx_rehab_sessions_phase_date" ON "rehabilitation_sessions" USING btree ("phase_id","session_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_roles_name" ON "roles" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sports_name" ON "sports" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_teams_name" ON "teams" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_roles_pair" ON "user_roles" USING btree ("user_id","role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_email" ON "users" USING btree ("email");