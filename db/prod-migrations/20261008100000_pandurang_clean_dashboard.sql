-- Pandurang Patil: clean team dashboard. Employee-level Access Control rows (editable in Access Control).
insert into access_overrides (scope_type, scope_id, module_key, sub_module_key, can_view)
values
 ('employee','bcb812f8-5c89-46c5-821e-91a55871476c','dashboard','w_radar',false),
 ('employee','bcb812f8-5c89-46c5-821e-91a55871476c','dashboard','w_org_tree',false),
 ('employee','bcb812f8-5c89-46c5-821e-91a55871476c','dashboard','w_team_people_only',true),
 ('employee','bcb812f8-5c89-46c5-821e-91a55871476c','dashboard','w_readiness',true),
 ('employee','bcb812f8-5c89-46c5-821e-91a55871476c','dashboard','w_live_people',true),
 ('employee','bcb812f8-5c89-46c5-821e-91a55871476c','dashboard','w_people_insights',true),
 ('employee','bcb812f8-5c89-46c5-821e-91a55871476c','payroll','',true),
 ('employee','bcb812f8-5c89-46c5-821e-91a55871476c','invoice','',true)
on conflict do nothing;
update access_overrides set can_view = v.can_view, updated_at = now()
from (values ('w_radar',false),('w_org_tree',false),('w_team_people_only',true)) v(k,can_view)
where scope_type='employee' and scope_id='bcb812f8-5c89-46c5-821e-91a55871476c' and module_key='dashboard' and sub_module_key=v.k;
