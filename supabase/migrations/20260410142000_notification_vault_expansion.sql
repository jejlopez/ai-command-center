-- Migration: Add missing notification and theme columns to user_settings
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS slack_webhook_url text,
  ADD COLUMN IF NOT EXISTS notification_email text,
  ADD COLUMN IF NOT EXISTS theme_preference text DEFAULT 'obsidian',
  ADD COLUMN IF NOT EXISTS human_hourly_rate numeric(10,2) DEFAULT 42.00,
  ADD COLUMN IF NOT EXISTS command_style text DEFAULT 'hybrid',
  ADD COLUMN IF NOT EXISTS alert_posture text DEFAULT 'balanced',
  ADD COLUMN IF NOT EXISTS quiet_hours_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiet_hours_start text DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS quiet_hours_end text DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS notification_route text DEFAULT 'command_center',
  ADD COLUMN IF NOT EXISTS commander_persona text DEFAULT 'founder',
  ADD COLUMN IF NOT EXISTS trusted_write_mode text DEFAULT 'review_first',
  ADD COLUMN IF NOT EXISTS approval_doctrine text DEFAULT 'risk_weighted';
