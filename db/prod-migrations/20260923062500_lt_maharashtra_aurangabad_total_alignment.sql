-- Align the two L&T Maharashtra resources mapped to the Aurangabad column
-- with the source sheet's final rounded billing total of Rs. 36,419.
begin;

update contract_resources r
   set employer_contributions = (
         select jsonb_agg(
           case
             when x->>'costComponentId' = 'cc101120-0001-4001-8001-000000000001'
               then jsonb_set(x, '{amount}', to_jsonb(1030::numeric))
             else x
           end
           order by ord
         )
           from jsonb_array_elements(r.employer_contributions) with ordinality as e(x, ord)
       ),
       updated_at = now()
  from client_contracts c
  join units u on u.id = c.unit_id
  join designations d on d.name = 'Security Guard'
 where r.contract_id = c.id
   and r.designation_id = d.id
   and r.shift_hours = 12
   and u.customer_id = '77ddd7f3-bd79-4453-b0d7-f7e533687353'
   and u.code in ('CLI4288', 'CLI4336');

commit;