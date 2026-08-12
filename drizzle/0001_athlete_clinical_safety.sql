ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "allergies" text DEFAULT 'None recorded' NOT NULL;
--> statement-breakpoint
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "chronic_conditions" text DEFAULT 'None recorded' NOT NULL;
--> statement-breakpoint
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "prohibited_medications" text DEFAULT 'None recorded' NOT NULL;
