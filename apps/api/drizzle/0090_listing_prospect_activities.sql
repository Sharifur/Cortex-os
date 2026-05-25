CREATE TABLE "listing_prospect_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"prospect_id" text NOT NULL,
	"type" text NOT NULL DEFAULT 'manual',
	"summary" text NOT NULL,
	"content" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listing_prospect_activities" ADD CONSTRAINT "listing_prospect_activities_prospect_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."listing_prospects"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "listing_prospect_activities_prospect_idx" ON "listing_prospect_activities" USING btree ("prospect_id");
