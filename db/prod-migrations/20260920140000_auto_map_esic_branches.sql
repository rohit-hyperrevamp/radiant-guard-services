-- Map every client site to its ESIC branch (sub-code) automatically from the
-- site's city, falling back to the state. Existing manual mappings are kept.
begin;

create temporary table tmp_city_esic(city_key text primary key, location text) on commit drop;
insert into tmp_city_esic(city_key, location) values
  ('pune','PUNE Pune City'),('pune city','PUNE Pune City'),('pimpri','PUNE Pune City'),
  ('pimpri chinchwad','PUNE Pune City'),('chakan','PUNE Chakan'),('ranjangaon','PUNE Ranjangaon'),
  ('baramati','Baramati'),
  ('mumbai','MUMBAI'),('greater mumbai','MUMBAI'),('mumbai suburban','MUMBAI'),('navi mumbai','MUMBAI'),
  ('thane','MUMBAI'),('palghar','MUMBAI'),('raigad','MUMBAI'),('raigarh','MUMBAI'),
  ('dombivli','MUMBAI'),('kalyan','MUMBAI'),
  ('nashik','NASHIK 1'),('nasik','NASHIK 1'),('malegaon','NASHIK 1'),
  ('nagpur','NAGPUR'),('sangli','SANGLI'),('kolhapur','KOLHAPUR'),('solapur','SOLAPUR'),
  ('satara','SATARA'),('ahmednagar','AHMEDNAGAR'),('ahmadnagar','AHMEDNAGAR'),('jalgaon','JALGAON'),
  ('ahmedabad','AHMEDABAD'),('gandhinagar','AHMEDABAD'),('surat','SURAT'),('rajkot','RAJKOT'),
  ('vadodara','GUJARAT Baroda'),('baroda','GUJARAT Baroda'),
  ('bengaluru','BANGALORE (Karnataka)'),('bangalore','BANGALORE (Karnataka)'),
  ('bengaluru rural','BANGALORE (Karnataka)'),('bangalore rural','BANGALORE (Karnataka)'),
  ('bengaluru urban','BANGALORE (Karnataka)'),('bellur','Bellur (Karnataka)'),
  ('hyderabad','Hyderabad'),('secunderabad','Hyderabad'),('rangareddy','Hyderabad'),('ranga reddy','Hyderabad'),
  ('goa','GOA'),('north goa','GOA'),('south goa','GOA'),('panjim','GOA'),('panaji','GOA'),
  ('margao','GOA'),('vasco','GOA'),('vasco da gama','GOA'),('calangute','GOA'),
  ('udaipur','UDAIPUR'),('alwar','Alwar'),('bhopal','BHOPAL'),('guwahati','GUWAHATI'),
  ('gurgaon','GURGAON'),('gurugram','GURGAON');

create temporary table tmp_state_esic(state_key text primary key, location text) on commit drop;
insert into tmp_state_esic(state_key, location) values
  ('maharashtra','PUNE Pune City'),('gujarat','AHMEDABAD'),('karnataka','BANGALORE (Karnataka)'),
  ('telangana','Hyderabad'),('goa','GOA'),('rajasthan','UDAIPUR'),
  ('madhya pradesh','BHOPAL'),('haryana','GURGAON'),('assam','GUWAHATI');

with norm as (
  select u.id,
         lower(regexp_replace(coalesce(u.billing_city,''), '[^a-zA-Z0-9]+', ' ', 'g')) as city_key,
         lower(regexp_replace(coalesce(u.billing_state,''), '[^a-zA-Z0-9]+', ' ', 'g')) as state_key
  from public.units u
  where u.esic_branch_id is null
), b as (
  select id, lower(regexp_replace(location, '[^a-zA-Z0-9]+', ' ', 'g')) as loc_key
  from public.esic_branches
  where enabled is true
), resolved as (
  select n.id,
         coalesce(
           (select b.id from tmp_city_esic c join b on b.loc_key = lower(regexp_replace(c.location,'[^a-zA-Z0-9]+',' ','g'))
              where c.city_key = btrim(n.city_key) limit 1),
           (select b.id from b where b.loc_key = btrim(n.city_key) limit 1),
           (select b.id from tmp_state_esic s join b on b.loc_key = lower(regexp_replace(s.location,'[^a-zA-Z0-9]+',' ','g'))
              where s.state_key = btrim(n.state_key) limit 1)
         ) as branch_id
  from norm n
)
update public.units u
set esic_branch_id = r.branch_id
from resolved r
where u.id = r.id and r.branch_id is not null;

commit;
