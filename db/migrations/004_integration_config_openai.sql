-- Allow an "openai" row in integration_config (OpenAI API key for WhatsApp
-- intent classification) — previously only settable via the OPENAI_API_KEY
-- env var, with no database-backed/Settings-UI config like the other
-- integrations (meta/whatsapp/wordpress/smtp) have.
alter table integration_config drop constraint integration_config_key_check;
alter table integration_config
  add constraint integration_config_key_check
  check (key in ('meta', 'whatsapp', 'wordpress', 'smtp', 'openai'));
