-- Fix security advisor warning: rls_disabled_in_public for public.telegram_files
-- Enable RLS if the table exists; keep default deny for anon/authenticated.
DO $$
BEGIN
  IF to_regclass('public.telegram_files') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.telegram_files ENABLE ROW LEVEL SECURITY';
  END IF;
END
$$;
