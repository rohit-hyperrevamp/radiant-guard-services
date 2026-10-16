-- Align September bank attendance with the issued Sep 2026 tax invoices (Pages checked first).
create table if not exists _bkp_bank_att_20261016 as
select e.* from attendance_entries e join units u on u.id=e.unit_id
where u.code in ('CLI1018','CLI3956','CLI1371','CLI1373','CLI3041','CLI1372','CLI4735','CLI2670','CLI3726','CLI3724','CLI4768')
  and e.entry_date between '2026-09-01' and '2026-09-30';
create table if not exists _bkp_bank_att_res_20261016 as select * from contract_resources where id in ('ec14bd36-779a-4c76-8f4c-00f22c044f82','7fc01373-ed63-415e-ace0-48b899207897');

create temp table _fix(unit text, emp text, day date, new_ot numeric, del boolean default false);
insert into _fix values
 ('CLI1018','47911','2026-09-01',0,false),
 ('CLI3956','45793','2026-09-01',0,false),
 ('CLI3726','44898','2026-09-27',0,false),
 ('CLI3724','44965','2026-09-02',0,false),
 ('CLI4735','35599','2026-09-09',0,false),('CLI4735','35599','2026-09-10',0,false),('CLI4735','35599','2026-09-11',0,false),
 ('CLI2670','35448','2026-09-02',0,false),('CLI2670','35448','2026-09-03',0,false),('CLI2670','35448','2026-09-04',0,false),
 ('CLI3041','37559','2026-09-26',1,false),
 ('CLI1372','27827','2026-09-26',1,false),
 ('CLI4768','44724','2026-09-12',1,false),
 ('CLI1371','43726',null,null,true),
 ('CLI1373','49681',null,null,true);

update attendance_entries e set ot_hours=f.new_ot, updated_at=now()
from _fix f, units u, candidates c
where not f.del and u.code=f.unit and c.employee_code=f.emp and e.unit_id=u.id and e.candidate_id=c.id and e.entry_date=f.day;

delete from attendance_entries e using _fix f, units u, candidates c
where f.del and u.code=f.unit and c.employee_code=f.emp and e.unit_id=u.id and e.candidate_id=c.id
  and e.entry_date between '2026-09-01' and '2026-09-30';

-- CLI4473 (BOB Malleshwaram Branch, billed on the same invoice as CLI4660): invoice rate ₹30,341.74 / 26.
update contract_resources r set employer_contributions =
  (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
  || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice)','state','N/A','amount',
       round(30341.74 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
                      - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
       'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
  updated_at=now()
where r.id in ('ec14bd36-779a-4c76-8f4c-00f22c044f82','7fc01373-ed63-415e-ace0-48b899207897');
update client_contracts set exact_day_rate=true, updated_at=now() where contract_code='CON16169';
