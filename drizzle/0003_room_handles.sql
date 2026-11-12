ALTER TABLE "rooms" ADD COLUMN "handle" text;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_handle_unique" UNIQUE("handle");--> statement-breakpoint
UPDATE "rooms" SET "handle" = 'brightloaf' WHERE "id" = (SELECT "id" FROM "rooms" WHERE "is_sample" = true ORDER BY "created_at" LIMIT 1);
