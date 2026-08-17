CREATE TABLE IF NOT EXISTS "rehabilitation_measurements" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL REFERENCES "rehabilitation_sessions"("id"),
	"plan_id" text NOT NULL REFERENCES "rehabilitation_plans"("id"),
	"metric_type" text NOT NULL,
	"label" text NOT NULL,
	"numeric_value" double precision,
	"text_value" text DEFAULT '' NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"context" text DEFAULT '' NOT NULL,
	"recorded_at" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rehab_measurements_plan_date" ON "rehabilitation_measurements" USING btree ("plan_id","recorded_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rehab_measurements_session" ON "rehabilitation_measurements" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rehab_measurements_plan_metric" ON "rehabilitation_measurements" USING btree ("plan_id","metric_type","recorded_at");
