-- Enable RLS on tables identified by security advisors
-- This implicitly denies all access to these tables for anon and authenticated roles
-- Access is restricted to service_role only (which bypasses RLS)

ALTER TABLE public.telegram_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_update_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_processed_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_messages_index ENABLE ROW LEVEL SECURITY;
