-- Second pass: resolve city/state for units whose city held a state name, an address fragment or was blank

begin;

update public.units set billing_city = 'Hyderabad', billing_state = 'Telangana' where id = '5df66384-c906-48bf-8e15-3caac87b0182'; -- CLI1043:  / Telangana
update public.units set billing_city = 'Sirsi', billing_state = 'Karnataka' where id = '17835fd1-9f4b-45ce-8441-2b835f94e37a'; -- CLI1255:  / Karnataka
update public.units set billing_city = 'Kolhapur', billing_state = 'Maharashtra' where id = '14bcc177-524c-4e5b-9570-64d44ec33e35'; -- CLI1296:  / Maharashtra
update public.units set billing_city = 'Panjim', billing_state = 'Goa' where id = '65d5cdb3-efaa-4b8e-9e76-05ea6388dc47'; -- CLI1298: Goa / Goa
update public.units set billing_city = 'North Goa', billing_state = 'Goa' where id = '456f00c1-c3f1-401e-a0df-e6e777dcdb75'; -- CLI1384: Goa / Goa
update public.units set billing_city = 'Ahmedabad', billing_state = 'Gujarat' where id = 'b8bcf08c-5ac3-49ee-9325-d4b742f8e8c8'; -- CLI1405: Gujarat / Gujarat
update public.units set billing_city = 'Ahmedabad', billing_state = 'Gujarat' where id = '7239127f-660f-43b9-9e8e-5521bfd0c021'; -- CLI1406: Gujarat / Gujarat
update public.units set billing_city = 'Ahmedabad', billing_state = 'Gujarat' where id = 'b3afec5d-f1da-43e1-b76f-2a3b4cf5e215'; -- CLI1407: Gujarat / Gujarat
update public.units set billing_city = 'North Goa', billing_state = 'Goa' where id = '5babc140-3a59-41a3-952e-f6194e7a8fef'; -- CLI1490: Goa / Goa
update public.units set billing_city = 'Panjim', billing_state = 'Goa' where id = '533d1cd1-fc09-49d2-83a9-89b62bd281ba'; -- CLI1492: Goa / Maharashtra
update public.units set billing_city = 'Aurangabad', billing_state = 'Maharashtra' where id = '4c796688-a86e-4cad-be30-219163cce07d'; -- CLI1881: Maharashtra / Maharashtra
update public.units set billing_city = 'Akola', billing_state = 'Maharashtra' where id = 'b1107cbe-23bf-45c6-98c7-61e3794d5bd8'; -- CLI1882: Maharashtra / Maharashtra
update public.units set billing_city = 'Amravati', billing_state = 'Maharashtra' where id = '6f87d7a0-308b-4c52-9144-f335ba1b12e5'; -- CLI1883: Maharashtra / Maharashtra
update public.units set billing_city = 'Solapur', billing_state = 'Maharashtra' where id = '8f3124c9-a309-4ee3-94e9-f47ca20ff5c8'; -- CLI1884: Maharashtra / Maharashtra
update public.units set billing_city = 'Dharashiv', billing_state = 'Maharashtra' where id = '1ba3df06-0088-493b-a828-c4a7cfc50b45'; -- CLI1885: Maharashtra / Maharashtra
update public.units set billing_city = 'Nagpur', billing_state = 'Maharashtra' where id = 'fb4ac7fa-41ee-4489-b636-025be8a93380'; -- CLI1886: Maharashtra / Maharashtra
update public.units set billing_city = 'Nagpur', billing_state = 'Maharashtra' where id = '44110f65-c3ab-4114-b841-0e3dff12e223'; -- CLI1887: Maharashtra / Maharashtra
update public.units set billing_city = 'Nagpur', billing_state = 'Maharashtra' where id = 'b99bcf0a-56a6-43c0-b8c2-42a51bd5d64b'; -- CLI1888: Maharashtra / Maharashtra
update public.units set billing_city = 'Nagpur', billing_state = 'Maharashtra' where id = 'ffbba652-189f-4d2b-99c8-628b48ca3569'; -- CLI1889: Maharashtra / Maharashtra
update public.units set billing_city = 'Bhandara', billing_state = 'Maharashtra' where id = 'ee8e02b1-b9ff-44c5-b1b2-c4a2cf6b2de5'; -- CLI1890: Maharashtra / Maharashtra
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '0364dc91-3778-4059-b531-4c1bd74cdbad'; -- CLI1891: Maharashtra / Maharashtra
update public.units set billing_city = 'Aurangabad', billing_state = 'Maharashtra' where id = 'e1566240-db52-474b-a422-4f5e4eb8bab7'; -- CLI1892: Maharashtra / Maharashtra
update public.units set billing_city = 'Jalgaon', billing_state = 'Maharashtra' where id = 'ebfc651f-d276-4d55-95d5-3fd3689a72bf'; -- CLI1893: Maharashtra / Maharashtra
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = 'd9313f25-8783-4216-9fcf-95c7c75d7b92'; -- CLI1917: Maharashtra / Maharashtra
update public.units set billing_city = 'Suryapet', billing_state = 'Telangana' where id = 'b57a2f16-f1f7-4f6a-9b25-be08f8f38fb3'; -- CLI2273: Telangana / Telangana
update public.units set billing_city = 'Ahmedabad', billing_state = 'Gujarat' where id = 'a5afb888-cc75-4d5c-9a60-8bc03c3eb6b2'; -- CLI2276:  / Gujarat
update public.units set billing_city = 'Thane', billing_state = 'Maharashtra' where id = '8b4c948c-448e-42e7-b017-030dc6f03900'; -- CLI2281:  / Maharashtra
update public.units set billing_city = 'Bundi', billing_state = 'Rajasthan' where id = 'b799d61b-203a-48b8-8111-4303616cad29'; -- CLI2370:  / Bundi Kota Highway
update public.units set billing_city = 'Nagpur', billing_state = 'Maharashtra' where id = '49c3f3aa-d78f-4b51-b191-f332a4f05f6a'; -- CLI2282:  / Saoner
update public.units set billing_city = 'Hyderabad', billing_state = 'Telangana' where id = 'eb2251ff-b566-4e79-aad2-69eeede05e62'; -- CLI2541: Telangana / Telangana
update public.units set billing_city = 'Hyderabad', billing_state = 'Telangana' where id = 'a02d2c8c-2745-4c99-9671-f75fbbdf787e'; -- CLI2542: Telangana / Telangana
update public.units set billing_city = 'Hyderabad', billing_state = 'Telangana' where id = 'e20cb577-9620-4e7a-9490-4d8ee5469026'; -- CLI2543: Telangana / Telangana
update public.units set billing_city = 'Hyderabad', billing_state = 'Telangana' where id = '31dbdbd4-29d5-45ce-8e58-1c7fd6469269'; -- CLI2545: Telangana / Telangana
update public.units set billing_city = 'Hyderabad', billing_state = 'Telangana' where id = '73952948-f59f-4a91-8c29-52e809ec0a81'; -- CLI2546: Telangana / Telangana
update public.units set billing_city = 'Hyderabad', billing_state = 'Telangana' where id = 'f7d4a20c-6029-4b30-989f-e2ea176e1cd5'; -- CLI2547: Telangana / Telangana
update public.units set billing_city = 'Bengaluru', billing_state = 'Karnataka' where id = '97ac0906-4707-4d3c-affc-2de3b29cddae'; -- CLI2560:  / Karnataka
update public.units set billing_city = 'Bengaluru', billing_state = 'Karnataka' where id = '3b065a87-92b5-46b5-9b18-9ca176712bdd'; -- CLI2563:  / Mariyannapalya Bangalore Karnataka
update public.units set billing_city = 'Bengaluru', billing_state = 'Karnataka' where id = 'b18962d5-c314-4e68-9924-a9042001565d'; -- CLI2564:  / Sanjaynagar Bangalore Karnataka
update public.units set billing_city = 'Bengaluru', billing_state = 'Karnataka' where id = '5610e7b0-6fbc-4831-8199-f84d199cd943'; -- CLI2570:  / 4C 121 Pushpagiri 4Th Cross Kasturinagar
update public.units set billing_city = 'Bengaluru Rural', billing_state = 'Karnataka' where id = '7684d576-68a1-4eea-ba3c-2f0631d76bf6'; -- CLI2573:  / Sno 47 Jala Hobli Sonnapahalli Devanahalli Tq Bangalore
update public.units set billing_city = 'Bengaluru', billing_state = 'Karnataka' where id = '688e462c-6996-448b-92bd-f3cd70429d1f'; -- CLI2574:  / No 1 2Nd Main Road Ward No 95 Sultanpalya
update public.units set billing_city = 'Udaipur', billing_state = 'Rajasthan' where id = 'cd711b21-2255-49b2-bf9b-05e29600abd0'; -- CLI2631:  / Rajasthan
update public.units set billing_city = 'Thane', billing_state = 'Maharashtra' where id = '53352d2d-3065-4d1c-998a-99bc4d5e4ea5'; -- CLI2650:  / Maharashtra
update public.units set billing_city = 'North Goa', billing_state = 'Goa' where id = '1295b94a-cca8-4245-a2f4-6e2be8963665'; -- CLI2726:  / Mapusa Property
update public.units set billing_city = 'Bangalore', billing_state = 'Karnataka' where id = 'd17476b3-acd4-4d3d-bfaf-d9bc405437b8'; -- CLI2734:  / Karnataka
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = 'b0c9c694-eb84-43f2-b682-4eb58de7cf68'; -- CLI2765: Maharashtra / Maharashtra
update public.units set billing_city = 'Bangalore', billing_state = 'Karnataka' where id = '55ab00f8-67e4-43dc-849a-012b83b13924'; -- CLI2924:  / Karnataka
update public.units set billing_city = 'Raichur', billing_state = 'Karnataka' where id = 'd7e86598-63f7-4a96-8994-0c79af56a67b'; -- CLI3017:  / Karnataka
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = 'b5a7ce7b-5726-4b1b-9862-02ec45e1fac0'; -- CLI3174: Maharashtra / Maharashtra
update public.units set billing_city = 'Visakhapatnam', billing_state = 'Andhra Pradesh' where id = '48c7ba17-8795-4a7c-b765-58dd5004197a'; -- CLI3214: Andhra Pradesh / Andhra Pradesh
update public.units set billing_city = 'Raichur', billing_state = 'Karnataka' where id = '6f1ecc5b-345e-49cf-8a9b-a74a47e9af21'; -- CLI3473:  / Karnataka
update public.units set billing_city = 'Hyderabad', billing_state = 'Telangana' where id = '379e5618-f018-47d6-8c0b-f739376aef8b'; -- CLI3476:  / Telangana
update public.units set billing_city = 'Hyderabad', billing_state = 'Telangana' where id = '69544dcf-c98a-42a7-9655-109ba8f1ced1'; -- CLI3477:  / Telangana
update public.units set billing_city = 'Hyderabad', billing_state = 'Telangana' where id = 'c272336a-1144-42d0-9449-13fde60d87f8'; -- CLI3478:  / Telangana
update public.units set billing_city = 'Hyderabad', billing_state = 'Telangana' where id = '2b75c49d-a0f0-4097-bfdd-dda58ee7b833'; -- CLI3479:  / Telangana
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = 'fe485730-e092-41e7-9767-ee1c0b8fb008'; -- CLI3979:  / Kondhwa
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '83f7e6ee-1e91-4916-89bc-afd229a7a449'; -- CLI3870: Maharashtra / Maharashtra
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = 'ae2f53d1-492b-40a5-adc4-ce20d5b997a8'; -- CLI3871: Maharashtra / Maharashtra
update public.units set billing_city = 'Bengaluru', billing_state = 'Karnataka' where id = 'fd7f6400-7975-4d59-b0eb-295f22312d2b'; -- CLI4473:  / 
update public.units set billing_city = 'Hyderabad', billing_state = 'Telangana' where id = '0476a546-d106-4139-974e-e9b0a7e2cd03'; -- CLI3928:  / Hyderabad Medchal-Malkajigiri Dist Telangana
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = 'b19affb9-f0cd-402c-b7a3-8cb6eb7951bd'; -- CLI3936:  / Belmondo
update public.units set billing_city = 'Nagarkurnool', billing_state = 'Telangana' where id = '78a04b7f-cc4d-45bd-a99b-c7bf2bcbd345'; -- CLI3960: Telangana / Telangana
update public.units set billing_city = 'Bangalore', billing_state = 'Karnataka' where id = '9a73534c-ec32-4b93-b17d-7ac15052f7a7'; -- CLI4349: Karnataka / Karnataka
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '2980c020-bf21-4d2c-9d25-ec2dafa875c7'; -- CLI4384:  / Lonikand
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = '2734b4a8-a4ad-4f02-9f73-7d90797b84c2'; -- CLI5: Maharashtra / Maharashtra
update public.units set billing_city = 'Bangalore', billing_state = 'Karnataka' where id = '51b88682-6c57-4db8-a5c7-85f9e95a962f'; -- CLI2866: Karnataka / Maharashtra
update public.units set billing_city = 'Jaipur', billing_state = 'Rajasthan' where id = '564aed8e-52af-4699-8e5e-8abdc0d412d6'; -- CLI4341:  / Rajasthan

commit;
