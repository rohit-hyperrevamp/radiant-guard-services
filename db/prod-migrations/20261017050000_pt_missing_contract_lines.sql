begin;
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI1468'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 150, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI1597'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI1760'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI1819'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI1956'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI2'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI2049'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI2097'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI2098'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI2157'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI2282'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI2368'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI2373'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI2555'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI2629'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI2636'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI2639'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI2695'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI2738'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI2741'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI2742'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI2757'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI2758'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI2842'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI292'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI293'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI294'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI301'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3018'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3024'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3034'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3065'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3095'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3210'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3212'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3306'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3345'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3387'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI342'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3464'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3471'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3532'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3533'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3535'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3536'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3537'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3538'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3542'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI355'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3558'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3640'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI370'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3715'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3716'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3717'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI376'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3765'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3791'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3793'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI381'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3842'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3871'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3938'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI3968'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI399'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI4039'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI4048'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI4049'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI4156'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI4201'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI4202'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI4232'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI4245'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI4375'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI4404'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI4407'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI4413'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI4414'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI4449'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI4491'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI4494'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI519'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI584'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
update contract_resources cr set deductions = cr.deductions || '{"name": "EE Professional Tax", "state": "N/A", "amount": 200, "calcType": "fixed", "capAmount": null, "percentage": 0, "formulaMode": "preset", "capFlatAmount": null, "baseComponents": [], "formulaVersion": 1, "costComponentId": null, "fixedCalcMethod": "flat", "fixedDutyDivisor": null, "deductionCalcType": "fixed_amount", "formulaExpression": null, "fixedDutyComponents": []}'::jsonb, updated_at=now()
from client_contracts cc join units u on u.id=cc.unit_id
where cr.contract_id=cc.id and u.code='CLI586'
and not exists (select 1 from jsonb_array_elements(cr.deductions) d where d->>'name' ilike '%professional tax%');
commit;
