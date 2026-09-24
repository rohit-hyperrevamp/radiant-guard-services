-- CON16019 (Rathi Legacy) Security Guard 12h: map to L&T Bangalore sheet, 37323.51 / 26 = 1435.52 per day.
-- Reuse the supervisor line's structure (same heads) with guard amounts.
with sup as (
  select components c, employer_contributions e from contract_resources where id='6233b6a1-f1d8-4c6b-84e2-d4dfa8be95f5'
)
update contract_resources r set
  components = jsonb_build_array(
    jsonb_set(sup.c->0,'{amount}','15742.26'), jsonb_set(sup.c->1,'{amount}','3254.40'),
    jsonb_set(sup.c->2,'{amount}','300.00'),   jsonb_set(sup.c->3,'{amount}','100.00'),
    jsonb_set(sup.c->4,'{amount}','9498.33')),
  employer_contributions = jsonb_build_array(
    jsonb_set(sup.e->0,'{amount}','2469.57'), jsonb_set(sup.e->1,'{amount}','617.39'),
    jsonb_set(sup.e->2,'{amount}','2245.41'), jsonb_set(sup.e->3,'{amount}','1582.42'),
    jsonb_set(sup.e->4,'{amount}','913.74'),  jsonb_set(sup.e->5,'{amount}','600.00')),
  updated_at = now()
from sup where r.id='ad853fdd-0393-4a24-9ed1-a471851c0731';
