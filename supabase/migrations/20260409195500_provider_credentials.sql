-- ============================================================
-- Provider credentials for model-routing integrations
-- ============================================================

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS openai_api_key text,
  ADD COLUMN IF NOT EXISTS google_api_key text;
