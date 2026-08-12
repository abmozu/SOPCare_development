ALTER TABLE "practitioner_profiles" ADD COLUMN IF NOT EXISTS "default_encounter_type" text DEFAULT 'Medical Review' NOT NULL;
--> statement-breakpoint
ALTER TABLE "practitioner_profiles" ADD COLUMN IF NOT EXISTS "clinic_city" text DEFAULT 'Riyadh' NOT NULL;
--> statement-breakpoint
ALTER TABLE "practitioner_profiles" ADD COLUMN IF NOT EXISTS "clinic_type" text DEFAULT 'Sports Medicine Clinic' NOT NULL;
--> statement-breakpoint
ALTER TABLE "practitioner_profiles" ADD COLUMN IF NOT EXISTS "clinic_location" text DEFAULT 'SOPCare Performance Center' NOT NULL;
--> statement-breakpoint
UPDATE "practitioner_profiles" SET "default_encounter_type" = 'Physiotherapy Review', "clinic_type" = 'Physiotherapy Clinic', "clinic_city" = 'Dhahran', "clinic_location" = 'SOPCare Dhahran Training Center' WHERE "specialty" = 'Physiotherapy';
--> statement-breakpoint
UPDATE "practitioner_profiles" SET "default_encounter_type" = 'Nutrition Follow-up', "clinic_type" = 'Sports Nutrition Clinic' WHERE "specialty" = 'Sports Nutrition';
--> statement-breakpoint
UPDATE "practitioner_profiles" SET "default_encounter_type" = 'Performance Psychology', "clinic_type" = 'Sports Psychology Clinic', "clinic_city" = 'Dhahran', "clinic_location" = 'SOPCare Dhahran Training Center' WHERE "specialty" = 'Sports Psychology';
