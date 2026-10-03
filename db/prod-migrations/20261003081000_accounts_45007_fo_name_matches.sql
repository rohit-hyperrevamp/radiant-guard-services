-- 45007 sheet: three FOs listed with old IDs, matched by name/phone (1751->49511 Datta Sagar, 5161->49512 Janardhan Medhe, 350->49517 Ashish Khandagale).
begin;
insert into public.employee_scope_assignments (candidate_id, scope_type, scope_id, scope_label)
select distinct c.id,'unit',u.id::text,u.code||' - '||u.name
  from (values
  ('CLI4373','49511'),
  ('CLI4348','49511'),
  ('CLI4347','49511'),
  ('CLI4313','49511'),
  ('CLI4289','49511'),
  ('CLI4345','49512'),
  ('CLI4320','49512'),
  ('CLI4328','49512'),
  ('CLI4222','49512'),
  ('CLI4287','49512'),
  ('HOLD','49512'),
  ('CLI4435','49517'),
  ('CLI4437','49517'),
  ('CLI4436','49517'),
  ('CLI4438','49517'),
  ('CLI4433','49517'),
  ('CLI4511','49512'),
  ('CLI4512','49517'),
  ('CLI4553','49517')) v(cli,emp)
  join public.units u on u.code=v.cli
  join public.candidates c on c.employee_code=v.emp
 where not exists (select 1 from public.employee_scope_assignments s where s.candidate_id=c.id and s.scope_type='unit' and s.scope_id=u.id::text);
commit;
