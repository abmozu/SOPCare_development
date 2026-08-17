CREATE TABLE "rehabilitation_measurements" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"plan_id" text NOT NULL,
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
ALTER TABLE "rehabilitation_measurements" ADD CONSTRAINT "rehabilitation_measurements_session_id_rehabilitation_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."rehabilitation_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rehabilitation_measurements" ADD CONSTRAINT "rehabilitation_measurements_plan_id_rehabilitation_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."rehabilitation_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_rehab_measurements_plan_date" ON "rehabilitation_measurements" USING btree ("plan_id","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_rehab_measurements_session" ON "rehabilitation_measurements" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_rehab_measurements_plan_metric" ON "rehabilitation_measurements" USING btree ("plan_id","metric_type","recorded_at");
