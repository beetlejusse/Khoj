-- Add finalized_itinerary column to planning_sessions table
ALTER TABLE "planning_sessions" ADD COLUMN "finalized_itinerary" jsonb;
