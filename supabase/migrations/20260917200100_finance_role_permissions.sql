begin;
update role_permissions
   set can_view=false, can_edit=false, can_delete=false, can_approve=false, updated_at=now()
 where role_key='finance'
   and module_key in ('control_center','employees','inventory','uniform','assets','vehicles');
commit;
select module_key, sub_module_key, can_view from role_permissions where role_key='finance' and can_view order by 1,2;
