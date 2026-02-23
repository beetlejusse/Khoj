-- Planning sessions table
CREATE TABLE IF NOT EXISTS "planning_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"destination" text NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"days" integer,
	"interests" text[],
	"must_visit_places" text[],
	"status" text DEFAULT 'gathering_info' NOT NULL,
	"conversation_history" jsonb,
	"approved_places" text[] DEFAULT '{}',
	"rejected_places" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Discovered places table
CREATE TABLE IF NOT EXISTS "discovered_places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"place_id" text NOT NULL,
	"place_name" text NOT NULL,
	"place_type" text,
	"rating" integer,
	"source" text NOT NULL,
	"lat" integer,
	"lng" integer,
	"formatted_address" text,
	"relevance_score" integer,
	"status" text DEFAULT 'suggested' NOT NULL,
	"user_feedback" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Foreign keys
ALTER TABLE "planning_sessions" ADD CONSTRAINT "planning_sessions_user_id_user_user_id_fk" 
  FOREIGN KEY ("user_id") REFERENCES "public"."user"("user_id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "discovered_places" ADD CONSTRAINT "discovered_places_session_id_planning_sessions_id_fk" 
  FOREIGN KEY ("session_id") REFERENCES "public"."planning_sessions"("id") ON DELETE cascade ON UPDATE no action;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_planning_sessions_user ON planning_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_planning_sessions_status ON planning_sessions(status);
CREATE INDEX IF NOT EXISTS idx_discovered_places_session ON discovered_places(session_id);
