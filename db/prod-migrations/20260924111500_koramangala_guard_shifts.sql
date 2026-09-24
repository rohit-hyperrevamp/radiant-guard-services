-- Koramangala (CON15944) 8-hour guards per Sep-2026 MIS.
update candidate_units cu set shift_hours = 8, updated_at = now()
from candidates c, client_contracts k
where cu.candidate_id = c.id and k.contract_code = 'CON15944' and cu.unit_id = k.unit_id
  and c.employee_code in ('47566','32965','36415','48629','36997');
