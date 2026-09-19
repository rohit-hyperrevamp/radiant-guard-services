-- Fill blank client (unit) cities that can be read unambiguously from the site name

begin;

update public.units set billing_city = 'Gadag' where id = 'beb5d8f7-e49a-481f-84dd-0dc1f076e8a9'; -- CLI1261 BAJAJ FINANCE LTD. GEDAG
update public.units set billing_city = 'Ahmedabad' where id = '11841bc8-0a2d-4c18-a78c-1302fbbb966e'; -- CLI1368 BANK OF BARODA - GIRDHAR NAGAR
update public.units set billing_city = 'Kolar' where id = '8d5e6985-6f45-478b-9e13-d69b72d433a8'; -- CLI1469 BAJAJ ELECTRICALS LTD - BE - RAMASAMUDRA
update public.units set billing_city = 'Bengaluru' where id = '9b2a05ee-2ffc-4a94-bfb0-f03947a61506'; -- CLI1815 ICICI BANK LTD - CPC RAMAGONDANHALLI
update public.units set billing_city = 'Dharwad' where id = '4a38bbba-92a1-473b-8727-feb552c3a58e'; -- CLI1817 ICICI BANK LTD - KALASAPUR-(ICICI KALASA
update public.units set billing_city = 'Ahmedabad' where id = '12033cda-ebf5-4a0b-a3b4-fbfb8f5cdb11'; -- CLI2033 BANK OF BARODA - GANDHI ROAD-(BOB GANDHI
update public.units set billing_city = 'Chitradurga' where id = '7b89f43f-74ee-46b2-ad1e-dc4334e694a1'; -- CLI2021 BAJAJ ELECTRICALS LIMITED - HOSADURGA
update public.units set billing_city = 'Kolar' where id = '653dba2b-740d-4959-a06a-3a412b244066'; -- CLI2633 BAJEL PROJECTS LTD - RAMASAMUDRA-(BAJEL 
update public.units set billing_city = 'Chitradurga' where id = 'a293252d-08d9-42c5-90e0-88ea07a31c63'; -- CLI2635 BAJEL PROJECTS LTD- HOSADURGA
update public.units set billing_city = 'Shivamogga' where id = 'b8ebc95f-00a3-49e7-b0d9-435af639f57b'; -- CLI2909 BAJEL PROJECTS LTD - SHIMOGA
update public.units set billing_city = 'Dombivli' where id = 'fb545f50-d2c7-4746-bd72-0bc5b3e9d0bd'; -- CLI3106 MACROTECH DEVELOPERS -PALLAVA MANPADA AD
update public.units set billing_city = 'Dombivli' where id = 'b6b3d6cd-1353-4b52-a216-7bc0f4e23436'; -- CLI3109 MACROTECH DEVELOPERS  PALAVA MANPADA  SI
update public.units set billing_city = 'Mumbai' where id = '7ede4d07-4096-4d4f-b532-df6bc0689cd0'; -- CLI3170 MACROTECH DEVELOPERS -KURLA IN CITY -INF
update public.units set billing_city = 'Bengaluru' where id = '265a1cec-73ea-4477-be26-21b7cdf164c1'; -- CLI3194 SHAHI EXPORTS PRIVATE LIMITED [ GGR BELL
update public.units set billing_city = 'Thane' where id = 'e7c9f62e-0a4a-4bfd-9cde-eac5efc5a87b'; -- CLI3260 MACROTECH DEVELOPERS - C A ROAD, MANPADA

commit;
