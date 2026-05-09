-- Connector labels: editable text placed over a connector path.

alter table public.connectors
  add column if not exists label_text text,
  add column if not exists label_x double precision,
  add column if not exists label_y double precision;
