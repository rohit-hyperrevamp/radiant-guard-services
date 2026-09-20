-- MIS columns can be exposed as optional client attributes.
-- When a column is marked as a client attribute it shows up as a non-mandatory
-- field on every client of that organization; the value is stored in
-- mis_unit_values, so the MIS sheet picks it up automatically. Turning the
-- toggle off deletes the attribute (and its values) for all clients of that
-- organization.

ALTER TABLE public.mis_template_columns
  ADD COLUMN IF NOT EXISTS client_attribute boolean NOT NULL DEFAULT false;
