-- Rate structure / comparison export: granted to the Legal department only (for now)
insert into access_overrides(scope_type,scope_id,department_id,module_key,sub_module_key,can_view,can_edit,can_delete,can_approve)
select 'department','c61056b2-a649-4457-abcd-6cbc0b1a2ef8',null,'contracts','rate_export',true,false,false,false
where not exists (select 1 from access_overrides where scope_type='department' and scope_id='c61056b2-a649-4457-abcd-6cbc0b1a2ef8' and module_key='contracts' and sub_module_key='rate_export');
