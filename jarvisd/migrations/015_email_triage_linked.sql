-- Add linked_email column to email_triage for deal linking
ALTER TABLE email_triage ADD COLUMN linked_email TEXT;
CREATE INDEX IF NOT EXISTS idx_triage_linked ON email_triage(linked_email);
