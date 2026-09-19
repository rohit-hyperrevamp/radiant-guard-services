-- Final manual resolution of client (unit) city/state values that could only be read from the site name
begin;

update public.units set billing_city = 'South Goa',  billing_state = 'Goa'          where code = 'CLI1380'; -- Vasco da Gama
update public.units set billing_city = 'South Goa',  billing_state = 'Goa'          where code = 'CLI1381'; -- Margao
update public.units set billing_city = 'North Goa',  billing_state = 'Goa'          where code = 'CLI1488'; -- Calangute
update public.units set billing_city = 'South Goa',  billing_state = 'Goa'          where code = 'CLI1489'; -- Vasco
update public.units set billing_city = 'South Goa',  billing_state = 'Goa'          where code = 'CLI1491'; -- Vidyanagar, Goa
update public.units set billing_city = 'North Goa',  billing_state = 'Goa'          where code = 'CLI2079'; -- Chapel Road, Goa
update public.units set billing_city = 'Ahmedabad',  billing_state = 'Gujarat'      where code = 'CLI1516'; -- Ghodasar
update public.units set billing_city = 'Bengaluru',  billing_state = 'Karnataka'    where code = 'CLI1816'; -- Sarjapur Main Road
update public.units set billing_city = 'Hyderabad',  billing_state = 'Telangana'    where code = 'CLI2100'; -- Inorbit Road
update public.units set billing_city = 'Anantapur',  billing_state = 'Andhra Pradesh' where code = 'CLI2906'; -- Tadipatri
update public.units set billing_city = 'Singrauli',  billing_state = 'Madhya Pradesh' where code = 'CLI3';   -- Essar Power MP
update public.units set billing_city = 'Mumbai',     billing_state = 'Maharashtra'  where code in ('CLI4193','CLI4390','CLI4450'); -- Lower Parel
update public.units set billing_state = ''                                          where code = 'CLI4184'; -- test record, junk state text

commit;
