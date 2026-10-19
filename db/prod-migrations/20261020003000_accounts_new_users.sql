-- New Accounts staff logins (role: finance, like existing Accounts executives)
insert into candidates (full_name, mobile, status, role_key, unit_id, department_id, designation_id, application_date, preferred_joining_date) values
 ('Shubham Jarkal','9156453025','active','finance','0889cfb4-7fd6-44b4-bbac-7d7026e33f0f','cb644391-3ad5-4071-90f9-8ab41a395980','db461c6b-0b97-4baa-b51d-49e10aa5e521',current_date,current_date);
update candidates set role_key='finance', mobile='9156453022', is_enabled=true where employee_code='49222';
