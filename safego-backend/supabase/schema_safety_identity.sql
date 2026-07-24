-- 1. Add version column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL;

-- 2. Add identity snapshot columns to sos_events
ALTER TABLE public.sos_events
ADD COLUMN IF NOT EXISTS identity_snapshot JSONB,
ADD COLUMN IF NOT EXISTS profile_version INTEGER,
ADD COLUMN IF NOT EXISTS profile_updated_at TIMESTAMPTZ;
