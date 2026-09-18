-- Both operations VPs roll up to the AVP Operations (Col. Umed Singh, 31993).
update public.candidates c
set reports_to = (select id from public.candidates where employee_code = '31993')
where c.role_key = 'vp_operations'
  and c.employee_code <> '31993'
  and c.reports_to is null;
