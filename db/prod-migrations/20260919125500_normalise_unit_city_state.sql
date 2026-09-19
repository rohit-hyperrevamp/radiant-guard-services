-- Normalise client (unit) city and state values: typo, casing and stray-pincode cleanup
-- Generated from production data; canonical states = public.indian_states

begin;

update public.units set billing_city = 'Baramati', billing_state = 'Maharashtra' where id = '42080af6-be49-4368-9683-c96a1296a3d7'; -- CLI4375: Baramati Midc / Maharashtra
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '8210da1f-d7de-4427-8d35-ce4aa2903488'; -- CLI3940: Kharadi / Maharashtra
update public.units set billing_city = 'Baramati', billing_state = 'Maharashtra' where id = 'c07b40d9-8794-49a0-bcf7-09e898680fd8'; -- CLI3153: Baramati Midc / Maharashtra
update public.units set billing_city = 'Baramati', billing_state = 'Maharashtra' where id = '253fd48f-0c30-4102-b69c-4e99e812b196'; -- CLI4189: Baramati Midc / Maharashtra
update public.units set billing_city = 'Rajsamand', billing_state = 'Rajasthan' where id = '3828dd28-e7d1-427f-83aa-b093e426736b'; -- CLI1192: Rajasmand / 313211
update public.units set billing_city = 'Mumbai', billing_state = 'Gujarat' where id = '87efb0b9-8e7d-4b6a-9ec2-7b528f512c11'; -- CLI1201: Mumabi / Gujarat
update public.units set billing_city = 'Gurugram', billing_state = 'Haryana' where id = '01a670dc-927b-4c69-b5be-a21d6bfe2c95'; -- CLI1246: Gurgaon / Haryana
update public.units set billing_city = 'Nashik', billing_state = 'Maharashtra' where id = '91048dd4-1e8d-49b3-afc5-b12f5534a9df'; -- CLI1253: Nasik / Maharashtra
update public.units set billing_city = 'Nagpur', billing_state = 'Maharashtra' where id = 'ecd8aafe-d8cf-4778-ad65-3d168260eaae'; -- CLI1268: Nagpur / Maharashtara
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = 'a78dac3a-a967-4b92-ae6d-5d97adb1ca66'; -- CLI1270: Pune / Maharashtara
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = 'f8caabff-7138-4bcb-8114-7d223063c340'; -- CLI1271: Pune / Maharashtara
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '2b138bfc-9eb9-49ff-8803-6ee4fcb31d25'; -- CLI1272: Pune / Maharashtara
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '8fbe340a-ef4a-49e2-83ea-553e4be51316'; -- CLI1273: Pune / Maharashtara
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '71d79fb6-fc1b-4abb-8cc0-ae98f2811294'; -- CLI1274: Pune / Maharashtara
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '4ad92ebb-0181-474b-8047-4a9ff43f86f5'; -- CLI1275: Pune / Maharashtara
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '6c76dee5-e45e-4e36-bdcf-2fe0f5449e90'; -- CLI1276: Pune / Maharashtara
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = 'c0bbdf4a-6ee4-45bb-baa7-3a24e8a43f75'; -- CLI1279: Pune / Maharashtara
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '9c9bd1eb-36f6-407f-9c86-4f31a3c9265c'; -- CLI1282: Pune / Maharashtara
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '7b816b6a-32e4-42d9-8fe9-7085572e6c19'; -- CLI1289: Pune / Maharashtara
update public.units set billing_city = 'Gandhinagar', billing_state = 'Gujarat' where id = '7e57c6ae-21b7-47ff-b7df-6a92b0b88ea3'; -- CLI1292: Gandhinagar / Gandhinagar
update public.units set billing_city = 'Ahmedabad', billing_state = 'Gujarat' where id = '2447de82-f0d0-48c6-8ca7-ce470281a0c9'; -- CLI1300: Ahmedabad / Gujrat
update public.units set billing_city = 'Indore', billing_state = 'Madhya Pradesh' where id = '9c8d99ad-059b-49cb-ab04-f0a1d475dbee'; -- CLI1317: Pritampura / Madhya Pradesh
update public.units set billing_city = 'Daman', billing_state = 'Gujarat' where id = 'f7573e1f-57d1-4407-a586-790b1388111b'; -- CLI1318: Gujarat / Gujarat
update public.units set billing_city = 'Lucknow', billing_state = 'Uttar Pradesh' where id = '5b7d0931-67f0-4953-980a-8fb637a2820d'; -- CLI1326: Luncknow / Uttar Pradesh
update public.units set billing_city = 'Gandhinagar', billing_state = 'Gujarat' where id = '3815272f-e404-44dc-93aa-768d716bd3b7'; -- CLI1336: Gandhinagar / Gujrat
update public.units set billing_city = 'Ahmedabad', billing_state = 'Gujarat' where id = 'c7b5f6de-414d-4681-acfe-b5e07edb9fdb'; -- CLI1346: Astodia / Gujarat
update public.units set billing_city = 'Ahmedabad', billing_state = 'Gujarat' where id = 'b5d3a146-50bc-4240-b93d-2f4e72ee1e1e'; -- CLI1347: Asarwa / Gujarat
update public.units set billing_city = 'Sabarkantha', billing_state = 'Gujarat' where id = 'fb2db539-d2c5-42bb-99f4-24df68fc6e11'; -- CLI1370: Gujarat / Gujarat
update public.units set billing_city = 'Mahesana', billing_state = 'Gujarat' where id = 'eac9f032-d51c-43a9-be94-e84a0db1ef0e'; -- CLI1371: Gujarat / Gujarat
update public.units set billing_city = 'Mahesana', billing_state = 'Gujarat' where id = 'e8085a47-b48f-41b8-b689-5ec192ec52e8'; -- CLI1372: Gujarat / Gujarat
update public.units set billing_city = 'Sabarkantha', billing_state = 'Gujarat' where id = '1a942cf3-17d3-47ad-b305-5b5a26cb5daf'; -- CLI1373: Gujarat / Gujarat
update public.units set billing_city = 'Bangalore', billing_state = 'Karnataka' where id = '0edf47f1-7226-42de-ba78-6b1e07f594a6'; -- CLI1374: Banglore / Karnataka
update public.units set billing_city = 'North Goa', billing_state = 'Goa' where id = 'ffe1be02-0712-447d-ac32-7c843ade33c8'; -- CLI1382: Goa / Goa
update public.units set billing_city = 'North Goa', billing_state = 'Goa' where id = '9690643b-b1f4-4236-b638-7120ace400fe'; -- CLI1383: Goa / Goa
update public.units set billing_city = 'North Goa', billing_state = 'Goa' where id = 'b00e5134-4aa1-44c7-a92d-64ce53781355'; -- CLI1385: Goa / Goa
update public.units set billing_city = 'North Goa', billing_state = 'Goa' where id = '2f4ee245-a6c7-4586-9fea-698affd45a80'; -- CLI1386: Goa / Goa
update public.units set billing_city = 'South Goa', billing_state = 'Goa' where id = 'ced80b3f-c01a-448d-b90c-8f4584117a76'; -- CLI1387: Goa / Goa
update public.units set billing_city = 'South Goa', billing_state = 'Goa' where id = '3c5a35f7-92ac-4bf0-933a-3d0e60f1f8dc'; -- CLI1388: Goa / Goa
update public.units set billing_city = 'Dadra & Nagar Haveli', billing_state = 'Dadra and Nagar Haveli and Daman and Diu' where id = '555fc839-f74b-4347-b4e4-e644505fdffa'; -- CLI1467: Dadra & Nagar Haveli / Dadra & Nagar Haveli
update public.units set billing_city = 'Satara', billing_state = 'Maharashtra' where id = '4da5c3ea-47ee-44c4-b6a4-a3c3ca321a56'; -- CLI1478: Satrara / Maharashtra
update public.units set billing_city = 'Ahmednagar', billing_state = 'Maharashtra' where id = 'b472fcf7-d541-470c-9ef0-7ae6c4e791a8'; -- CLI1497: Ahmed Nagar / Maharashtra
update public.units set billing_city = 'Ratnagiri', billing_state = 'Maharashtra' where id = '270ff55f-fe8f-4266-8ef8-bd0b7d22d531'; -- CLI1498: Rantnagiri / Maharashtra
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = '4373e3d9-8cc2-4b63-8c19-92c5d8c6160e'; -- CLI1509: Raigarh(Mh) / Maharashtra
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '95f61bef-cbf2-40a6-b660-9fdc25050f09'; -- CLI2031:  / Pune
update public.units set billing_city = 'Gandhinagar', billing_state = 'Gujarat' where id = '2a9aba41-be59-4251-91c0-2d6f260993dd'; -- CLI1537: Gandhi Nagar / Gujarat
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = '32eae2fd-bced-4136-867d-677257614283'; -- CLI1541: Surendra Nagar / Gujarat
update public.units set billing_city = 'Gandhinagar', billing_state = 'Gujarat' where id = 'dc967691-7203-4d13-a02b-e31eba5aa7c1'; -- CLI1542: Gandhi Nagar / Gujarat
update public.units set billing_city = 'Ahmednagar', billing_state = 'Maharashtra' where id = 'da97c70c-a3f0-40ca-97f7-b86192d904bf'; -- CLI1551: Ahmed Nagar / Maharashtra
update public.units set billing_city = 'Mahabubnagar', billing_state = 'Telangana' where id = 'c57fdfe4-8796-4e18-b3a3-573589da5b29'; -- CLI1552: Mahabub Nagar / Telangana
update public.units set billing_city = 'Bhopal', billing_state = 'Madhya Pradesh' where id = 'a6e91872-553c-47ee-a5f8-9830a41fd70d'; -- CLI1559: Bhopal / Madhya Paradesh
update public.units set billing_city = 'Mahabubnagar', billing_state = 'Telangana' where id = '1025df0f-14cf-4a09-9d33-4a2d744b92f3'; -- CLI1560: Mahabub Nagar / Telangana
update public.units set billing_city = 'Rangareddy', billing_state = 'Telangana' where id = '0033e87d-fa8e-41a1-8344-cf3ac4f7bbb8'; -- CLI1561: K.v.rangareddy / Telangana
update public.units set billing_city = 'Shivamogga', billing_state = 'Karnataka' where id = 'c95eff23-0edf-47a8-be62-c0a6051162c9'; -- CLI1567: Shimoga / Karnataka
update public.units set billing_city = 'Tumakuru', billing_state = 'Karnataka' where id = '14d9a3b4-ddf2-48b9-8583-2b91a75ac6f3'; -- CLI1571: Tumkur / Karnataka
update public.units set billing_city = 'Chikkamagaluru', billing_state = 'Karnataka' where id = 'b269f1f8-5c3b-4422-80ae-b4057326d3a3'; -- CLI1572: Chickmagalur / Karnataka
update public.units set billing_city = 'Chikkamagaluru', billing_state = 'Karnataka' where id = '4463ea6e-2ffc-4e19-b524-c5b92b748f5b'; -- CLI1573: Chickmagalur / Karnataka
update public.units set billing_city = 'Rangareddy', billing_state = 'Telangana' where id = '8ad39912-635a-450a-8dd0-6e3a8318229f'; -- CLI1582: K.v.rangareddy / Telangana
update public.units set billing_city = 'Gandhinagar', billing_state = 'Gujarat' where id = '153d9632-4fc1-4059-ae41-94d4c0d1a5e3'; -- CLI1584: Gandhi Nagar / Gujarat
update public.units set billing_city = 'Mahabubnagar', billing_state = 'Telangana' where id = '670bf3b6-f619-4908-b5fc-c4c951756fb0'; -- CLI1586: Mahabub Nagar / Telangana
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = 'd04e3c41-50ec-4c17-a563-eb374045a03c'; -- CLI1588: Punee / Maharashtra
update public.units set billing_city = 'Ahmednagar', billing_state = 'Maharashtra' where id = 'e7c6447a-a6fa-405e-8941-1c3ebbfd4ee2'; -- CLI1608: Ahmed Nagar / Maharashtra
update public.units set billing_city = 'Bangalore', billing_state = 'Karnataka' where id = 'c41ccf0f-6167-4336-ab50-08e2b23cc655'; -- CLI1613: Banglore / Karnataka
update public.units set billing_city = 'Chamarajanagar', billing_state = 'Karnataka' where id = '96bff2af-cf17-4e6b-b2c9-8deda99c81f1'; -- CLI1617: Chamrajnagar / Karnataka
update public.units set billing_city = 'Chikkamagaluru', billing_state = 'Karnataka' where id = '4c440e92-0325-424d-a5c2-a713f0f0ea1e'; -- CLI1622: Chickmagalur / Karnataka
update public.units set billing_city = 'Shivamogga', billing_state = 'Karnataka' where id = 'e8e506ed-bc3a-4e7e-8f87-f27027b70d2a'; -- CLI1640: Shimoga / Karnataka
update public.units set billing_city = 'Alwar', billing_state = 'Rajasthan' where id = '71947258-19f7-4ba7-bbe4-7d26c2961bc6'; -- CLI2369:  / Alwar
update public.units set billing_city = 'Ahmednagar', billing_state = 'Maharashtra' where id = 'a9afc375-7579-4b35-a7b3-e55753f6604a'; -- CLI1663: Ahmed Nagar / Maharashtra
update public.units set billing_city = 'Ahmednagar', billing_state = 'Maharashtra' where id = '1f7f7ca3-815c-448d-9a3c-b06c25bd3a00'; -- CLI1680: Ahmed Nagar / Maharashtra
update public.units set billing_city = 'Tumakuru', billing_state = 'Karnataka' where id = '188c517a-990d-483b-9792-6ada8b380662'; -- CLI1699: Tumkur / Karnataka
update public.units set billing_city = 'Shivamogga', billing_state = 'Karnataka' where id = 'a7e961e5-725e-445a-9ace-efe8950bdfe0'; -- CLI1701: Shimoga / Karnataka
update public.units set billing_city = 'Ahmednagar', billing_state = 'Maharashtra' where id = 'ccf3f2a7-adaa-470f-833e-1eb25e590319'; -- CLI1716: Ahmed Nagar / Maharashtra
update public.units set billing_city = 'Gandhinagar', billing_state = 'Gujarat' where id = 'cabcd160-a4ba-4392-94bd-cb16d066c0f4'; -- CLI1723: Gandhi Nagar / Gujarat
update public.units set billing_city = 'Bangalore', billing_state = 'Karnataka' where id = 'ec63229e-d5e3-42af-a8fe-a0d7d0e68b30'; -- CLI1726: Banglore / Karnataka
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '9685577c-1155-4ffb-be26-8c8f5b213892'; -- CLI1736: Maharashtra / Maharashtra
update public.units set billing_city = 'Yadgir', billing_state = 'Karnataka' where id = '78f4ba3e-af8a-410a-bb10-baf7d1206fa1'; -- CLI1747: Yadgir / Karnaraka
update public.units set billing_city = 'Belagavi', billing_state = 'Karnataka' where id = 'a2a215a9-c923-464a-b476-a79d1b118030'; -- CLI1749: Belgavi / Karnataka
update public.units set billing_city = 'Gulbarga', billing_state = 'Karnataka' where id = 'b1a156f0-f010-48f7-a18d-1e520957ec91'; -- CLI1762: Karnataka / Karnataka
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = '76661346-ba57-4550-abd7-30b32ed3635d'; -- CLI1958: Vikhroli / Mumbai
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = 'a2cba28d-4b30-425b-afcd-d3ec5581ec67'; -- CLI1785: Surendra Nagar / Gujarat
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = '36e11311-a470-49b3-af22-83a85eff34c0'; -- CLI1787: Surendra Nagar / Gujarat
update public.units set billing_city = 'Gandhinagar', billing_state = 'Gujarat' where id = 'd3f7730d-8672-41e9-b219-f54cefe4ca81'; -- CLI1791: Gandhi Nagar / Gujarat
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '4b1f8482-c83d-4fc2-a760-4e8f3366552b'; -- CLI1801: Hadapsar / Maharashtra
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '6bfd20e7-3831-412c-88cd-1279e3afec5b'; -- CLI1802: Hadapsar / Maharashtra
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = 'd4bd8fff-31ef-44c9-9012-53efbe28ed9f'; -- CLI1803: Hadapsar / Maharashtra
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = 'ee09aa2d-4534-4d13-8964-dda770521aca'; -- CLI1821: Hadapsar / Maharashtra
update public.units set billing_city = 'Bangalore', billing_state = 'Karnataka' where id = 'df47af56-6cc7-4715-980c-5e7c178476ae'; -- CLI2373: Banglore / Karnataka
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '4cb86aa6-c99e-422e-a34f-45c6aa55fed1'; -- CLI1825: Infotech  Park (Hinjawadi) / Pune
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = '86ff1810-1fc4-4ca3-ace3-4a76ea72110b'; -- CLI1859: Surendra Nagar / Gujarat
update public.units set billing_city = 'Sabarkantha', billing_state = 'Gujarat' where id = '5a204db7-4bc3-44a2-bc3d-496b9760153a'; -- CLI1897: Sabarkhantha / Gujarat
update public.units set billing_city = 'Chamarajanagar', billing_state = 'Karnataka' where id = '8096818b-73c0-4794-8082-2787a06d416f'; -- CLI1903: Chamrajnagar / Karnataka
update public.units set billing_city = 'Surat', billing_state = 'Gujarat' where id = '886faa58-847a-4f92-9028-6cbab066275c'; -- CLI1905: Suart / Gujarat
update public.units set billing_city = 'Surat', billing_state = 'Gujarat' where id = 'e1bd8aea-e974-4149-ba94-34e6dacdd129'; -- CLI1906: Gujarat / Gujarat
update public.units set billing_city = 'Surat', billing_state = 'Gujarat' where id = '9bb0a4ee-1c83-4e5c-a0e2-c7680ce7f427'; -- CLI1907: Gujarat / Gujarat
update public.units set billing_city = 'Surat', billing_state = 'Gujarat' where id = '247e1f10-b567-4c6e-95b7-d0508510bfea'; -- CLI1908: Gujarat / Gujarat
update public.units set billing_city = 'Ahmedabad', billing_state = 'Gujarat' where id = 'b095017d-42c1-481a-9ebf-85e21c08d664'; -- CLI1909: Gujarat / Gujarat
update public.units set billing_city = 'Ahmedabad', billing_state = 'Gujarat' where id = 'da090253-3b3c-46f5-8b61-cd45ca572aa3'; -- CLI1910: Gujarat / Gujarat
update public.units set billing_city = 'Nagpur', billing_state = 'Maharashtra' where id = '345b46ec-e7b5-47fd-a739-247dbc3a941c'; -- CLI1912: Nagpur / Maharahstra
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = '6be6bdc1-2f12-4fe2-835b-c6497ae53a60'; -- CLI1921: Surendra Nagar / Gujarat
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = '278de583-c841-41d0-ac5a-49593c94836c'; -- CLI1926: Surendra Nagar / Gujarat
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = 'a3eca07e-2b2d-4b5c-8ffa-fee5e2e3d3e4'; -- CLI1935: Maval / Maharashtra
update public.units set billing_city = 'Vijayapura', billing_state = 'Karnataka' where id = '0a495307-b8d6-406e-af69-0225dd89571f'; -- CLI1948: Bijapur(Kar) / Karnataka
update public.units set billing_city = 'Shivamogga', billing_state = 'Karnataka' where id = '2862da9b-8555-49ec-aed3-0e454f1d660f'; -- CLI1951: Shimoga / Karnataka
update public.units set billing_city = 'Karnataka', billing_state = 'Maharashtra' where id = '51b88682-6c57-4db8-a5c7-85f9e95a962f'; -- CLI2866: KARNATAKA / Maharashtra
update public.units set billing_city = 'Nashik', billing_state = 'Maharashtra' where id = 'c8c920cc-baa0-4cb0-bc11-98bd2da45c4a'; -- CLI1962: Nashik / Nashik
update public.units set billing_city = 'Nashik', billing_state = 'Maharashtra' where id = '3ada0c5a-3d2b-4cd0-9901-02696028e05e'; -- CLI1963: Pimpalgaon / Nashik
update public.units set billing_city = 'Rajkot', billing_state = 'Gujarat' where id = 'ccff0ba1-ff72-4cde-aca2-2f2ef5ef814d'; -- CLI1977: Rajkot / Rajkot
update public.units set billing_city = 'Gandhinagar', billing_state = 'Gujarat' where id = '619bbe39-1d80-47a0-831b-2f9d8f3c882f'; -- CLI1985: Gandhi Nagar / Gujarat
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = 'eeff1cc3-416a-477f-aadc-fca251a25b28'; -- CLI1988: Surendra Nagar / Gujarat
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = 'd0297d08-3dee-4557-afbb-916974e3c1b6'; -- CLI2006: Raigarh(Mh) / Maharashtra
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = '2954fb1a-119b-4755-8a6f-ff538220b6a9'; -- CLI2007: Raigarh(Mh) / Maharashtra
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = '7b35569f-4f2f-400f-8804-58ef45dcb032'; -- CLI2008: Raigarh(Mh) / Maharashtra
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = '3d695ca4-5cbc-42ff-85c3-d856cec39118'; -- CLI2009: Raigarh(Mh) / Maharashtra
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = 'c373382c-1c6c-4c1a-a72b-2c17f6b86178'; -- CLI2010: Raigarh(Mh) / Maharashtra
update public.units set billing_city = 'Rangareddy', billing_state = 'Telangana' where id = '7d442af9-6e6a-4645-90d8-e976ce5b4276'; -- CLI2019: K.v.rangareddy / Telangana
update public.units set billing_city = 'Raipur', billing_state = 'Chhattisgarh' where id = 'd82deedd-9967-4969-b9fe-91888315a120'; -- CLI2023: Raipur / Chattisgarh
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = '01fdc19a-904b-4be4-a40e-2454ca6f02b2'; -- CLI2027: Maharashtra / Maharashtra
update public.units set billing_city = 'New Delhi', billing_state = 'Delhi' where id = '0f7c605c-4fcc-446e-9b10-39145868a843'; -- CLI2060: Central Delhi / Delhi
update public.units set billing_city = 'Chamarajanagar', billing_state = 'Karnataka' where id = '94d19f73-1a6a-4fbe-9d80-713aa6b55c9c'; -- CLI2070: Chamrajnagar / Karnataka
update public.units set billing_city = 'Chamarajanagar', billing_state = 'Karnataka' where id = '39000df1-e790-419d-85fb-b52e12d0752f'; -- CLI2073: Chamrajnagar / Karnataka
update public.units set billing_city = 'Chamarajanagar', billing_state = 'Karnataka' where id = '4a83803b-4513-4799-b34b-b3e4cc5319d6'; -- CLI2075: Chamrajnagar / Karnataka
update public.units set billing_city = 'Chamarajanagar', billing_state = 'Karnataka' where id = '1229ff42-bd87-4f2c-90e6-a46d97246767'; -- CLI2076: Chamrajnagar / Karnataka
update public.units set billing_city = 'Vijayapura', billing_state = 'Karnataka' where id = '57796de8-b923-4e84-b8a0-13830d74d0bc'; -- CLI2090: Bijapur(Kar) / Karnataka
update public.units set billing_city = 'Rangareddy', billing_state = 'Telangana' where id = 'b116a78b-f537-43ae-ae88-c84f0bbb93cf'; -- CLI2108: K.v.rangareddy / Telangana
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '8292035b-bf16-46ca-ac5d-517cd3fd3177'; -- CLI2109: Hadpsar I.e. / Pune
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '76e5db5e-23c8-4af0-b18e-a61aab8aa667'; -- CLI2123:  / Pune
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = '466835a2-5ddd-4c02-9e96-3c7d30c5f911'; -- CLI2137: Raigarh(Mh) / Maharashtra
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = '9e10f07b-4b07-4429-9757-1db3c1252c4e'; -- CLI2141: Raigarh(Mh) / Maharashtra
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = '9a5261ee-1d41-48db-9cb4-171a9f08bcef'; -- CLI2142: Raigarh(Mh) / Maharashtra
update public.units set billing_city = 'Nagpur', billing_state = 'Maharashtra' where id = '70ac92d4-2d8d-4d78-8884-b41636f6eae1'; -- CLI2146: Nagpur / Maharastra
update public.units set billing_city = 'Shivamogga', billing_state = 'Karnataka' where id = 'b74dbbd9-ea5e-4169-8e4f-f1244c4aae12'; -- CLI2147: Shimoga / Karnataka
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = 'da61972c-7025-4abe-aeed-85b4f627439a'; -- CLI2155: Raigarh(Mh) / Maharashtra
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = 'fb69b64d-725b-4e8e-8635-48ef82a2a6d5'; -- CLI2168: Sangavi / Pune
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = '911758ce-2807-40f3-835c-298251aac05c'; -- CLI2170: Raigarh(Mh) / Maharashtra
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = '786267d9-4c49-4f99-ac3e-e463b6ef3061'; -- CLI2186: Raigarh(Mh) / Maharashtra
update public.units set billing_city = 'Ahmednagar', billing_state = 'Maharashtra' where id = '36788422-83cf-43b7-9f4a-8d22836af78b'; -- CLI2189: Ahmed Nagar / Maharashtra
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = '1b6f3788-5025-41ac-8221-959fdce46f72'; -- CLI2192: Raigarh(Mh) / Maharashtra
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = 'a3a322d9-dc65-493f-bd4d-9aa555bcc75b'; -- CLI2205: Surendra Nagar / Gujarat
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = '0e1c0908-d140-4aff-a8b5-d7542631703b'; -- CLI2211: Surendra Nagar / Gujarat
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = 'b23c5d4d-0042-4220-bc01-662d0eca80e5'; -- CLI2374: Pune / Pune
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = 'd7e21542-a7fd-4580-9c19-cdf65fefae06'; -- CLI2239: Surendra Nagar / Gujarat
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = '25f6fe4f-a6f7-445c-a061-faff4f015686'; -- CLI2247: Surendra Nagar / Gujarat
update public.units set billing_city = 'Karimnagar', billing_state = 'Telangana' where id = '95673283-6d20-4371-93d4-700e26486f78'; -- CLI2254: Karim Nagar / Telangana
update public.units set billing_city = 'Mahabubnagar', billing_state = 'Telangana' where id = '62237ddc-fedb-4ddf-8ece-28c9a34c175f'; -- CLI2255: Mahabub Nagar / Telangana
update public.units set billing_city = 'Karimnagar', billing_state = 'Telangana' where id = 'caa3691f-3494-4b79-a85c-56fc13581938'; -- CLI2256: Karim Nagar / Telangana
update public.units set billing_city = 'Karimnagar', billing_state = 'Telangana' where id = 'baf3dce9-4e34-4952-8988-26301389aa3c'; -- CLI2257: Karim Nagar / Telangana
update public.units set billing_city = 'Karimnagar', billing_state = 'Telangana' where id = '9be0cc84-56bb-43b2-9f98-ac67d89e40e7'; -- CLI2261: Karim Nagar / Telangana
update public.units set billing_city = 'Karimnagar', billing_state = 'Telangana' where id = '5cc3f85f-3594-451c-b9fd-c22d1f6a8ec4'; -- CLI2266: Karim Nagar / Telangana
update public.units set billing_city = 'Mahabubnagar', billing_state = 'Telangana' where id = 'b39205d0-86a3-49cc-a27d-ad636f3bdc84'; -- CLI2269: Mahabub Nagar / Telangana
update public.units set billing_city = 'Karimnagar', billing_state = 'Telangana' where id = '50b90346-2dd4-4e26-8c95-b7f23d152e56'; -- CLI2272: Karim Nagar / Telangana
update public.units set billing_city = 'Gandhinagar', billing_state = 'Gujarat' where id = 'c5f5b7cd-7732-4966-b355-53732cb09298'; -- CLI2275: Gandhinagar / Gujarat-
update public.units set billing_city = 'Ahmedabad', billing_state = 'Gujarat' where id = '6bbcb8cf-02a0-4a4e-b78c-3653d93c3deb'; -- CLI2277:  / Gujarat
update public.units set billing_city = 'Bengaluru', billing_state = 'Karnataka' where id = 'eb2d977c-8839-4cf1-b95a-aa361646e26d'; -- CLI2289: Koramangala Vi Bk / Bangalore
update public.units set billing_city = 'Karimnagar', billing_state = 'Telangana' where id = '5630d4f4-c135-4ff4-b9ad-a7cec2169747'; -- CLI2302: Karim Nagar / Telangana
update public.units set billing_city = 'Karimnagar', billing_state = 'Telangana' where id = 'b0719612-973d-43b1-9f49-eca81ae53d0e'; -- CLI2308: Karim Nagar / Telangana
update public.units set billing_city = 'Karimnagar', billing_state = 'Telangana' where id = 'e9e7f602-da4c-402c-b77f-7d3fa1940958'; -- CLI2312: Karim Nagar / Telangana
update public.units set billing_city = 'Rangareddy', billing_state = 'Telangana' where id = '68d9760f-131c-4096-968a-d37cbd50a6e9'; -- CLI2313: K.v.rangareddy / Telangana
update public.units set billing_city = 'Ahmednagar', billing_state = 'Maharashtra' where id = 'e72e8747-0d87-406a-a3ad-6a6af2340810'; -- CLI2317: Ahmed Nagar / Maharashtra
update public.units set billing_city = 'Gurugram', billing_state = 'Haryana' where id = 'a2b41530-3610-42a6-8d5c-344051c3cbcd'; -- CLI2343: Gurgaon / Haryana
update public.units set billing_city = 'Chikkamagaluru', billing_state = 'Karnataka' where id = 'ebdf263e-a277-4907-8135-58c587eca50f'; -- CLI2351: Chickmagalur / Karnataka
update public.units set billing_city = 'Vadodara', billing_state = 'Gujarat' where id = 'dc809c88-9c35-43af-bed2-628f80001ae8'; -- CLI2352: Vadodara / Gujrat
update public.units set billing_city = 'Ahmednagar', billing_state = 'Maharashtra' where id = '22904489-84d0-430c-a2c5-3c0a5ce0f9ac'; -- CLI2353: Ahmed Nagar / Maharashtra
update public.units set billing_city = 'Karimnagar', billing_state = 'Telangana' where id = '5d8ebaf7-9771-4eab-bef8-a4d95697d2e3'; -- CLI2355: Karim Nagar / Telangana
update public.units set billing_city = 'Dhule', billing_state = 'Maharashtra' where id = 'c50eef2f-5419-4f40-950e-43193e640906'; -- CLI2382: Midc Awadhan Dhule Maharashtra -424006 / Dhule
update public.units set billing_city = 'Tumakuru', billing_state = 'Karnataka' where id = '6bcf1a46-9840-4523-9c60-9b70fe620ffb'; -- CLI2384: Tumkur / Karnataka
update public.units set billing_city = 'Nagpur', billing_state = 'Maharashtra' where id = '45c14348-c77c-4937-b114-e54296e5d316'; -- CLI2427: Nagpur / Maharshtra
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = '712e9faf-de72-429e-b044-36367d01e322'; -- CLI2441: Raigarh(Mh) / Maharashtra
update public.units set billing_city = 'Hyderabad', billing_state = 'Telangana' where id = 'b880b4db-bf97-4128-ae51-b7b2d4a34f17'; -- CLI2453: Hyderabadt / Telangana
update public.units set billing_city = 'Hyderabad', billing_state = 'Telangana' where id = 'd2d3c9db-8fa3-445a-a29f-79c1066474ea'; -- CLI2454: Hyderabad / Talangana
update public.units set billing_city = 'Rangareddy', billing_state = 'Telangana' where id = '331c256e-d500-41f3-9a47-10fdb9ffacf2'; -- CLI2456: Ranga Reddy / Telangana
update public.units set billing_city = 'Rangareddy', billing_state = 'Telangana' where id = 'c76a0480-b923-45bb-ab2e-e3f3745c8cea'; -- CLI2457: Ranga Reddy / Telangana
update public.units set billing_city = 'Karimnagar', billing_state = 'Telangana' where id = '904eaf7a-bc5b-454e-bafe-4f1ee30aa748'; -- CLI2461: Karim Nagar / Telangana
update public.units set billing_city = 'Nizamabad', billing_state = 'Telangana' where id = 'b145a8f7-243e-48d1-8c73-d4b24ea7c519'; -- CLI2466: Nizamabad / Telanagana
update public.units set billing_city = 'Karimnagar', billing_state = 'Telangana' where id = 'f64af846-e72a-4c37-9518-df5593a3feb0'; -- CLI2467: Karim Nagar / Telangana
update public.units set billing_city = 'Karimnagar', billing_state = 'Telangana' where id = '308b7b5d-e0a9-4d8a-b186-d8180941fd90'; -- CLI2468: Karim Nagar / Telangana
update public.units set billing_city = 'Mahabubnagar', billing_state = 'Telangana' where id = '0903439f-705f-4d58-824a-dae001edc007'; -- CLI2474: Mahabub Nagar / Telangana
update public.units set billing_city = 'Mahabubnagar', billing_state = 'Telangana' where id = '63f65baa-bc2d-4e05-ad0a-31fb5c046dac'; -- CLI2475: Mahabub Nagar / Telangana
update public.units set billing_city = 'Mahabubnagar', billing_state = 'Telangana' where id = 'd911e9e8-c15e-4b3b-9df6-92d3fba8bd72'; -- CLI2477: Mahabub Nagar / Telangana
update public.units set billing_city = 'Mahabubnagar', billing_state = 'Telangana' where id = '6a4b9bac-9087-4c13-995a-897de71401bd'; -- CLI2478: Mahabub Nagar / Telangana
update public.units set billing_city = 'Mahabubnagar', billing_state = 'Telangana' where id = 'c5609bc5-9eda-4865-af7c-6096388eafc8'; -- CLI2479: Mahabub Nagar / Telangana
update public.units set billing_city = 'Karimnagar', billing_state = 'Telangana' where id = '565523c2-7bfb-426d-86ed-ddd8a982a5c8'; -- CLI2481: Karim Nagar / Telangana
update public.units set billing_city = 'Karimnagar', billing_state = 'Telangana' where id = '15318fd0-6fdf-4d04-bff2-8aa66a0ba5d6'; -- CLI2483: Karim Nagar / Telangana
update public.units set billing_city = 'Warangal', billing_state = 'Telangana' where id = '08833184-b2de-4dae-a5f0-fc0fe9b43a90'; -- CLI2485: Waragal / Telangana
update public.units set billing_city = 'Mahabubnagar', billing_state = 'Telangana' where id = '224c7043-5dfe-4511-9642-2ba58aae2b96'; -- CLI2494: Mahabub Nagar / Telangana
update public.units set billing_city = 'Rangareddy', billing_state = 'Telangana' where id = '225f0927-7392-4889-a828-cab02d1bffed'; -- CLI2502: Ranga Reddy / Telangana
update public.units set billing_city = 'Mahabubnagar', billing_state = 'Telangana' where id = 'f610a37d-d8c9-4daf-9a5c-30f0c11a2e88'; -- CLI2503: Mahabub Nagar / Telangana
update public.units set billing_city = 'Peddapalli', billing_state = 'Telangana' where id = '89247bb9-831c-4ed9-8e07-747f0aa28fe7'; -- CLI2504: Peddapelli / Telangana
update public.units set billing_city = 'Mahabubnagar', billing_state = 'Telangana' where id = '70725b5c-9f66-4dc4-b89a-20aae5c3bc7d'; -- CLI2508: Mahabub Nagar / Telangana
update public.units set billing_city = 'Rangareddy', billing_state = 'Telangana' where id = 'add82010-ae3d-49d1-ba01-89484f12bc4c'; -- CLI2509: Ranga Reddy / Telangana
update public.units set billing_city = 'Rangareddy', billing_state = 'Telangana' where id = 'a63c2fbf-86cd-4773-8a74-0acfd2c67d4e'; -- CLI2516: Ranga Reddy / Telangana
update public.units set billing_city = 'Rangareddy', billing_state = 'Telangana' where id = '3b39fd6b-752a-4acc-b574-dcc291e84906'; -- CLI2524: Ranga Reddy / Telangana
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = '98ac2cda-1f8f-4fae-b566-f048ec69b654'; -- CLI2527: Andheri East / Maharashtra
update public.units set billing_city = 'Nagpur', billing_state = 'Maharashtra' where id = 'e2b29d64-94dc-49a5-9fb4-7ecdea3f9007'; -- CLI2528: Nagpur / Maharastra
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '110d7dda-59fb-4bbe-ba85-f659ac624dfb'; -- CLI2529: Takawe Bk / Pune
update public.units set billing_city = 'Agra', billing_state = 'Uttar Pradesh' where id = '0be3595c-ab11-4b3f-9a45-a797e947dc6a'; -- CLI2544: Utter Pradesh / Utter Pradesh
update public.units set billing_city = 'Navi Mumbai', billing_state = 'Maharashtra' where id = 'f46c2d2b-0300-436a-93d1-86ee4ee1e372'; -- CLI2552: Nerul East / Navi Mumbai
update public.units set billing_city = 'Bengaluru', billing_state = 'Karnataka' where id = '0dbe0e9f-9f69-421d-85eb-ce3ab68627cf'; -- CLI2561: Banaswadi Main Rd. / Bangalore Karnataka
update public.units set billing_city = 'Bengaluru', billing_state = 'Karnataka' where id = '56d596a9-9a13-4e69-b179-23bf231c93a1'; -- CLI2562: Kamanahalli Main Road / Bangalore Karnataka
update public.units set billing_city = 'Bengaluru', billing_state = 'Karnataka' where id = 'e4af01b4-ac9c-4990-bcb9-6a33cc724222'; -- CLI2565: Near Koshy's Hosp.  Ramamurthynagar Ramamurthynagar Bangalore Karnataka / Ramamurthynagar Bangalore Karnataka
update public.units set billing_city = 'Bengaluru', billing_state = 'Karnataka' where id = '789d1925-219b-4e22-9110-e079aa060a81'; -- CLI2566: Diary Main Road / Double Road Yelahanka
update public.units set billing_city = 'Bengaluru', billing_state = 'Karnataka' where id = '8a96819a-5206-433d-8d16-bcaabc4bd25a'; -- CLI2567: Garden City College Campus / Virgonagar Bangalore Karnataka
update public.units set billing_city = 'Bengaluru', billing_state = 'Karnataka' where id = 'ad2c90f1-629e-4a6d-b8d7-8e6ea90bdd64'; -- CLI2568: Rmv Extension / Ii Stage Bangalore Karnataka
update public.units set billing_city = 'Tumakuru', billing_state = 'Karnataka' where id = 'b038dd53-fe40-451b-aba6-886808e1ee55'; -- CLI2606: Tumkur / Karnataka
update public.units set billing_city = 'Tumakuru', billing_state = 'Karnataka' where id = '96df3538-3146-42e4-a03f-89707c0f0679'; -- CLI2607: Tumkur / Karnataka
update public.units set billing_city = 'Tumakuru', billing_state = 'Karnataka' where id = 'c7392209-e36b-497c-a07e-ead4965aa614'; -- CLI2608: Tumkur / Karnataka
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = 'd3a5bcad-1b13-4476-ae47-7559c98b6a06'; -- CLI2630: Mumbai / Maharastra
update public.units set billing_city = 'Bangalore', billing_state = 'Karnataka' where id = '0cf40a4c-1503-4ed0-8170-2336d0456e70'; -- CLI2634: Banglore / Karnataka
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = '98df382e-cc04-4534-8679-12ec9b381bd7'; -- CLI2642: Raigarh(Mh) / Maharashtra
update public.units set billing_city = 'Gandhinagar', billing_state = 'Gujarat' where id = 'dc3afb16-bd3e-49bf-8048-2fd19e7ec809'; -- CLI2662: Gandhi Nagar / Gujarat
update public.units set billing_city = 'Gandhinagar', billing_state = 'Gujarat' where id = 'cfb70c5f-ffba-47e8-a6dc-dd4ae5b42704'; -- CLI2665: Gandhi Nagar / Gujarat
update public.units set billing_city = 'Gandhinagar', billing_state = 'Gujarat' where id = 'e40cdfa2-a13b-419a-ae4a-424741c658e2'; -- CLI2667: Gandhi Nagar / Gujarat
update public.units set billing_city = 'Gandhinagar', billing_state = 'Gujarat' where id = '1f1655b1-32e3-43c6-8c9a-cf76464eae3d'; -- CLI2668: Gandhi Nagar / Gujarat
update public.units set billing_city = 'Bangalore', billing_state = 'Karnataka' where id = '91350909-8f3a-43ec-953c-e249ef468799'; -- CLI2733:  / Bangalore
update public.units set billing_city = 'New Delhi', billing_state = 'Delhi' where id = '935c30e1-3189-4dbd-a83c-0f25b2871f82'; -- CLI2737: Central Delhi / Delhi
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = '82826cb2-ad82-4fa7-ab28-dd58a37d25c5'; -- CLI2738:  / Mumbai
update public.units set billing_city = 'Thane', billing_state = 'Maharashtra' where id = '11f9dd1e-ea51-4c16-8000-858dda4e25cd'; -- CLI2739: Maharashtra 400606 / Maharashtra
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = 'b00fda75-1783-4f2e-8fc4-74f8d4f0bbaf'; -- CLI2740: Mumbai - 400059 / Maharashtra
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = '9e3b67c7-4c9d-467e-8fe7-e08304d0c702'; -- CLI2741: Mumbai - 400059 / Maharashtra
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = '04561c24-21b4-4a89-a28d-bf665a264099'; -- CLI2743: Worli / Mumbai
update public.units set billing_city = 'Rangareddy', billing_state = 'Telangana' where id = 'd5ad7d19-0219-46ea-8174-3b2320bd9803'; -- CLI2748: K.v.rangareddy / Telangana
update public.units set billing_city = 'Shivamogga', billing_state = 'Karnataka' where id = '8be4b199-c811-45bc-a191-5269b3eaaaa7'; -- CLI2752: Shimoga / Karnataka
update public.units set billing_city = 'Chikkamagaluru', billing_state = 'Karnataka' where id = 'e89f289e-cce6-40db-b35d-34aa7d468e31'; -- CLI2753: Chickmagalur / Karnataka
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = 'b3f187fd-e311-4156-b832-957c255ae8c9'; -- CLI2759: Yerawada Pune 411006 / Maharashtra
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = 'ca42417e-f5fd-4152-b141-5cf9a6ca6ca2'; -- CLI2770: Surendra Nagar / Gujarat
update public.units set billing_city = 'Chikkamagaluru', billing_state = 'Karnataka' where id = '5149fecf-28da-4fe8-aab1-e2b51adad924'; -- CLI2773: Chickmagalur / Karnataka
update public.units set billing_city = 'Karimnagar', billing_state = 'Telangana' where id = '643f70e2-5b83-46ec-be10-d667fb4d4221'; -- CLI2787: Karim Nagar / Telangana
update public.units set billing_city = 'Mahabubnagar', billing_state = 'Telangana' where id = 'aee9e7bc-0641-4c2a-a84d-df6d37155bb8'; -- CLI2788: Mahabub Nagar / Telangana
update public.units set billing_city = 'Mahabubnagar', billing_state = 'Telangana' where id = '5eb3eaa5-da91-419b-ae7b-50ec5623b37e'; -- CLI2791: Mahabub Nagar / Telangana
update public.units set billing_city = 'Mahabubnagar', billing_state = 'Telangana' where id = 'e74502e5-f0be-4651-b6af-b10d787fbaed'; -- CLI2792: Mahabub Nagar / Telangana
update public.units set billing_city = 'Karimnagar', billing_state = 'Telangana' where id = 'ed4e0e8a-5fdd-486c-b212-061ba8588ca7'; -- CLI2799: Karim Nagar / Telangana
update public.units set billing_city = 'Mahabubnagar', billing_state = 'Telangana' where id = 'a1cf8771-82a0-4370-a559-307402dce33e'; -- CLI2803: Mahabub Nagar / Telangana
update public.units set billing_city = 'Mahabubnagar', billing_state = 'Telangana' where id = '07423ba4-680e-4086-be07-45fc30dc4856'; -- CLI2811: Mahabub Nagar / Telangana
update public.units set billing_city = 'Rangareddy', billing_state = 'Telangana' where id = '0421fd42-c7b5-4759-866c-ff89e32debf0'; -- CLI2812: K.v.rangareddy / Telangana
update public.units set billing_city = 'Mahabubnagar', billing_state = 'Telangana' where id = '10900f44-9bae-4fc3-8037-51cff8e34e04'; -- CLI2813: Mahabub Nagar / Telangana
update public.units set billing_city = 'Gurugram', billing_state = 'Haryana' where id = 'de6df007-46bc-4bc5-a40d-9415ca9ebd50'; -- CLI2815: Sector 65 And 15 Gurugram / Haryana
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = '8d00bd20-32e8-4cdc-9173-0becc7ec2158'; -- CLI2816: Near Hotel Tunga International / Andheri East
update public.units set billing_city = 'Chhatrapati Sambhajinagar', billing_state = 'Maharashtra' where id = '7e38814e-fb82-48f1-b6b9-05f37e4690e7'; -- CLI2820: Chhatrapati Sambhaji Nagar / Maharashtra
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = '165fcd3b-05a0-49f6-9051-f27324b64072'; -- CLI2842: MUMBAI / Maharashtra
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = '2393a18d-7681-4f41-bc16-22b32f2de207'; -- CLI2846: Surendra Nagar / Gujarat
update public.units set billing_city = 'Bangalore', billing_state = 'Karnataka' where id = 'bfaaa156-2321-43be-a60f-9c8064665c6d'; -- CLI285: Banglore / Karnataka
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = '31fc6101-39ea-428d-a71d-d7da94ca19f0'; -- CLI2871: Mumbai / Mumbai
update public.units set billing_city = 'Shankheshwar', billing_state = 'Gujarat' where id = '2a4e233a-9d98-4448-9099-a6cab02b0430'; -- CLI2896: Shankeshwar / Gujrat
update public.units set billing_city = 'Panch Mahals', billing_state = 'Gujarat' where id = 'd6ea89d1-a056-464b-903d-671f289969f4'; -- CLI2901: Panchmahal / Gujrat
update public.units set billing_city = 'Panch Mahals', billing_state = 'Gujarat' where id = '99cf8f1f-1b96-41bd-b9cb-66332701cae2'; -- CLI2903: Panch Mahals / Gujrat
update public.units set billing_city = 'Shivamogga', billing_state = 'Karnataka' where id = 'bd802303-d490-411d-9ab5-7c91083a5d3e'; -- CLI2917: Shimoga / Karnataka
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = '21ed2140-c58c-4479-8f6f-854743ea3b8b'; -- CLI2923:  / Mumbai
update public.units set billing_city = 'Anantapur', billing_state = 'Andhra Pradesh' where id = 'ab34fafb-c166-4a9f-b0ec-5f7176ce5c1d'; -- CLI2944: Ananthapur / Andhra Pradesh
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = '5d8490cf-ef73-40d2-9806-1af3461b4153'; -- CLI2962:  / Mumbai
update public.units set billing_city = 'Bangalore', billing_state = 'Karnataka' where id = '8bfe0e86-e5ec-4178-bab6-df9a27df8c5d'; -- CLI2965:  / Banglore
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = '001ab758-15fa-4547-9221-d6dee40623a6'; -- CLI2984: Surendra Nagar / Gujarat
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = '7e848e04-053e-4240-9295-d7e4b40bb8f8'; -- CLI2985: Surendra Nagar / Gujarat
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = '5aecb174-8ada-42ef-9e5d-d1cbccd9de3d'; -- CLI3026: Raigarh(Mh) / Maharashtra
update public.units set billing_city = 'Gandhinagar', billing_state = 'Gujarat' where id = 'fedf8a79-8a7b-4718-b845-df303455a736'; -- CLI3031: Gandhi Nagar / Gujarat
update public.units set billing_city = 'Bangalore', billing_state = 'Karnataka' where id = '8ae3b270-2e23-4f9e-8b7d-496cb9a87707'; -- CLI3033: BANGALORE / Karnataka
update public.units set billing_city = 'Raichur', billing_state = 'Karnataka' where id = 'f9ec199a-061a-420e-adbb-4f095645e1ee'; -- CLI3054:  / Raichur
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '8867cd85-47cc-4696-a2d9-b7ba3f21a06c'; -- CLI3062:  / Pune
update public.units set billing_city = 'Gandhinagar', billing_state = 'Gujarat' where id = '0197a2b8-7a4d-425e-a5c5-ec257aad3a9e'; -- CLI3067: Gandhi Nagar / Gujarat
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '08abf00e-2625-4fab-a35d-8dbb7839e711'; -- CLI3069: Hadapsar / Maharashtra
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = 'fff39158-a816-4819-bede-4d072810825c'; -- CLI3095: Pirangut / Maharashtra
update public.units set billing_city = 'Gurugram', billing_state = 'Haryana' where id = 'f10a0cbb-ea96-4ca9-adb4-08ee0c4647cf'; -- CLI3099: Sector 38 And  Gurugram / Haryana
update public.units set billing_city = 'Bengaluru', billing_state = 'Karnataka' where id = '3284b800-cef4-4e54-84af-3bfe7d555d44'; -- CLI3111: Devarabeesanahalli Village / Karnataka
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = '953c34f6-435e-46ee-9948-5f81fff69543'; -- CLI3113:  / Mumbai
update public.units set billing_city = 'Dharampur', billing_state = 'Maharashtra' where id = 'b9d0cb87-2b6e-456b-ba1d-c8aac78093c2'; -- CLI3120: Dharmpur / Maharashtra
update public.units set billing_city = 'Boisar', billing_state = 'Maharashtra' where id = '267c1b1c-c491-4735-9602-b0a9542507f4'; -- CLI3121: Bhoisar / Maharashtra
update public.units set billing_city = 'Ahmednagar', billing_state = 'Maharashtra' where id = '2e1eddea-2591-48b6-8308-81241233b1de'; -- CLI3123: Ahmed Nagar / Maharashtra
update public.units set billing_city = 'Rangareddy', billing_state = 'Telangana' where id = 'f0bd417d-f80f-4cc5-92d1-226a97b40177'; -- CLI3126: K.v.rangareddy / Telangana
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = '8e6c7d73-8abe-4ff0-9425-8b93472d7a65'; -- CLI3137: Raigarh(Mh) / Maharashtra
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = '6423da50-6b41-4d03-a584-fdb549e8ce39'; -- CLI3138: Raigarh(Mh) / Maharashtra
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = '3ac62097-23fd-427c-97b0-f355194538cd'; -- CLI3139: Raigarh(Mh) / Maharashtra
update public.units set billing_city = 'Gandhinagar', billing_state = 'Gujarat' where id = 'd16871d1-3542-43cd-bdc6-c82a8d8e7b37'; -- CLI315: Gandhi Nagar / Gujarat
update public.units set billing_city = 'Gandhinagar', billing_state = 'Gujarat' where id = '0c4ca205-d6cd-4386-9756-f81e29b8e935'; -- CLI3151: Gandhi Nagar / Gujarat
update public.units set billing_city = 'Tumakuru', billing_state = 'Karnataka' where id = 'e2e49f6d-f299-4c8b-a75e-cf7324a5a03c'; -- CLI3161: Tumkur / Karnataka
update public.units set billing_city = 'Gandhinagar', billing_state = 'Gujarat' where id = '4c7d4ec5-ac2d-4369-a958-67a9f18c77ac'; -- CLI3169: Gandhi Nagar / Gujarat
update public.units set billing_city = 'Indore', billing_state = 'Madhya Pradesh' where id = 'debe9f5a-a0b6-4b1d-8716-c8baa2c38615'; -- CLI317: Pritampura / Madhya Pradesh
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = 'e504496e-5096-4451-9ccd-88b08ba680f0'; -- CLI3171:  / Mumbai
update public.units set billing_city = 'Ankleshwar', billing_state = 'Gujarat' where id = 'f57ce30d-c723-48db-b45d-a167fd55db9a'; -- CLI3188: Ankleshwar / Gujarat / Gujarat
update public.units set billing_city = 'Dombivli', billing_state = 'Maharashtra' where id = '85f9206e-03ba-4dda-9d6b-0e3a475acc39'; -- CLI3189: Palava / Maharashtra
update public.units set billing_city = 'Gandhinagar', billing_state = 'Gujarat' where id = '36157d69-ee4e-45f4-a1bd-7d741ade252d'; -- CLI3190: Gandhi Nagar / Gujarat
update public.units set billing_city = 'Chikkamagaluru', billing_state = 'Karnataka' where id = 'd3a2e949-8a44-443e-9a8b-c1076f93e267'; -- CLI3193: Chickmagalur / Karnataka
update public.units set billing_city = 'Mahabubnagar', billing_state = 'Telangana' where id = '1e3c78eb-cb4c-482e-a46e-aef9b4fddada'; -- CLI3206: Mahabub Nagar / Telangana
update public.units set billing_city = 'Mahabubnagar', billing_state = 'Telangana' where id = 'd1226626-b7d9-4045-a0dc-08cc606ca5c2'; -- CLI3220: Mahabub Nagar / Telangana
update public.units set billing_city = 'Tumakuru', billing_state = 'Karnataka' where id = '38a67cb6-c591-4b95-be7e-2b3dfd39a063'; -- CLI3224: Tumkur / Karnataka
update public.units set billing_city = 'Ahmednagar', billing_state = 'Maharashtra' where id = 'e3751e52-083f-4359-a790-1ad5f8396a4d'; -- CLI3229: Ahmed Nagar / Maharashtra
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = 'a00e995e-87ea-4e3f-aa7b-39620a3239b3'; -- CLI3238: Surendra Nagar / Gujarat
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = '4fa239ec-fb0f-4491-88ea-b68694f6d2c7'; -- CLI3240: Surendra Nagar / Gujarat
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = 'bcb2f033-07b7-498e-a2c3-d56103c7e536'; -- CLI3241: Surendra Nagar / Gujarat
update public.units set billing_city = 'Karimnagar', billing_state = 'Telangana' where id = '5ed67caa-8bbc-4720-be5c-48e36b0b8288'; -- CLI3245: Karim Nagar / Telangana
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = 'a53a1790-af64-4f07-b7c2-b8c8cd9257a1'; -- CLI3246: Surender Nagar / Gujarat
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = 'bc8e054f-13e9-48ec-ad29-3907b1c7ee36'; -- CLI3251: Bund Garden / Pune
update public.units set billing_city = 'Shirur', billing_state = 'Maharashtra' where id = 'f4aa45e5-bdef-4339-9ce6-2875972e6c11'; -- CLI3252: Tal Shirur / Maharashtra
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = '47daedd3-2995-4de1-83a7-3dab22711d13'; -- CLI3253: Raigarh(Mh) / Maharashtra
update public.units set billing_city = 'Ahmednagar', billing_state = 'Maharashtra' where id = 'baaa7b52-a2a7-4f94-b57d-cd1f86c5be12'; -- CLI3254: Ahilyanagar / Maharashtra
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = '0958a34a-da7c-4b48-9bab-b7cacc68f30e'; -- CLI3256: Raigarh(Mh) / Maharashtra
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = 'b0271329-641d-49bc-af32-9820d0cc6836'; -- CLI3259: Dist. Pune - 412106. / Pune
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = 'e926e80c-74c0-4a01-94e3-6db5869a5a1d'; -- CLI3261:  / Mumbai
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = 'a712a185-1846-4a31-85ab-71aa889649d9'; -- CLI3262:  / Mumbai
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = 'b55124c4-b0c7-4209-8544-f3b22a320799'; -- CLI3263:  / Mumbai
update public.units set billing_city = 'Tumakuru', billing_state = 'Karnataka' where id = 'c2eb1f18-3428-4cfd-8ce7-b1c0d53520bf'; -- CLI3267: Tumkur / Karnataka
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '88f69107-9830-4187-bc65-bbb43ab875ff'; -- CLI3286: Pune / Maharshtra
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = 'ae2b1173-4e92-4b69-9abb-265783402ac1'; -- CLI3288: Chakan / Maharashtra
update public.units set billing_city = 'Rangareddy', billing_state = 'Telangana' where id = '5499da88-d9d6-4d59-8475-e9518cac8094'; -- CLI3290: K.v.rangareddy / Telangana
update public.units set billing_city = 'Chikkamagaluru', billing_state = 'Karnataka' where id = '40388f67-1e3c-4e5d-85e2-69c6f5395ad3'; -- CLI3316: Chickmagalur / Karnataka
update public.units set billing_city = 'Chamarajanagar', billing_state = 'Karnataka' where id = 'ced7393c-b891-46c6-9f19-6e143fea95e0'; -- CLI3318: Chamrajnagar / Karnataka
update public.units set billing_city = 'Chamarajanagar', billing_state = 'Karnataka' where id = 'da63d267-9be6-4838-80f6-5b4ede32b093'; -- CLI3322: Chamrajnagar / Karnataka
update public.units set billing_city = 'Chamarajanagar', billing_state = 'Karnataka' where id = 'ab2061de-9886-4e01-9a5c-f279602225a0'; -- CLI3326: Chamrajnagar / Karnataka
update public.units set billing_city = 'Chamarajanagar', billing_state = 'Karnataka' where id = '3a9e2a34-1fc8-4376-bb4e-5dab20e1b2eb'; -- CLI3327: Chamrajnagar / Karnataka
update public.units set billing_city = 'Chamarajanagar', billing_state = 'Karnataka' where id = '4960064a-f975-4ff6-a893-c66ed6ce8b4e'; -- CLI3331: Chamrajnagar / Karnataka
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = '56b16b17-4fde-4582-aa61-2d7d4a835873'; -- CLI3350: Raigarh(Mh) / Maharashtra
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = 'e50a9bb1-31a4-4cf5-95fd-90710fdcb680'; -- CLI3354: Pune / Maharashtra - 411007
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = '05218708-e7b6-4918-91dc-c171d45eac97'; -- CLI3363: Mumbai / Mahrashtra
update public.units set billing_city = 'Devbhoomi Dwarka', billing_state = 'Gujarat' where id = 'c5e51814-6903-45b9-acb9-5b918ca1fd81'; -- CLI3376: Devbhoomi Dwerka / Gujarat
update public.units set billing_city = 'Gir Somnath', billing_state = 'Gujarat' where id = 'be9421c5-69e3-4f69-8149-5cbbf6f0edda'; -- CLI3377: Girmnath / Gujarat
update public.units set billing_city = 'Gir Somnath', billing_state = 'Gujarat' where id = '08b7255f-6f1c-47fa-b72b-6b78ccf4c951'; -- CLI3379: Girmnath / Gujarat
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = 'f0d412a9-5f8a-48e2-9194-43a5ca16b777'; -- CLI3380: Surendra Nagar / Gujarat
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = '0f91480a-2674-4e69-957d-5b1a263774d7'; -- CLI3381: Surendra Nagar / Gujarat
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = 'e20d1518-4c13-4d44-9c4f-09979e6e8e5a'; -- CLI3382: Surendra Nagar / Gujarat
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = '406db728-da2f-42a2-8914-03c6f4c8f5a9'; -- CLI3383: Surendra Nagar / Gujarat
update public.units set billing_city = 'Mumbai Suburban', billing_state = 'Maharashtra' where id = 'faa8e644-db81-420f-bbdf-42f106122a66'; -- CLI3387: Mumbai Subueban / Maharashtra
update public.units set billing_city = 'Chamarajanagar', billing_state = 'Karnataka' where id = '0071b5c7-3dc4-4c8e-b560-87e5e006e8aa'; -- CLI3406: Chamrajnagar / Karnataka
update public.units set billing_city = 'Ahmednagar', billing_state = 'Maharashtra' where id = 'c08d65c6-f7ce-4876-a7e7-a53d60bf1f7d'; -- CLI3428: Ahmed Nagar / Maharashtra
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = '2d9e4525-8729-4b61-84ff-59299ed20164'; -- CLI3440:  / Mumbai
update public.units set billing_city = 'Secunderabad', billing_state = 'Telangana' where id = '599ed263-b70d-44ea-9acb-d0db8eaa85c5'; -- CLI3475: secunderabad / Telangana
update public.units set billing_city = 'Botad', billing_state = 'Gujarat' where id = 'c74a00c6-fea2-441d-b568-68d0875c2fd2'; -- CLI3508: Botab / Gujarat
update public.units set billing_city = 'Gir Somnath', billing_state = 'Gujarat' where id = '88b85f59-8310-4aad-a711-9777d169313b'; -- CLI3511: Girmnath / Gujarat
update public.units set billing_city = 'Ahmednagar', billing_state = 'Maharashtra' where id = 'e07aaafd-f97c-44e5-80e7-404a5d670954'; -- CLI3529: Ahmed Nagar / Maharashtra
update public.units set billing_city = 'Ahmednagar', billing_state = 'Maharashtra' where id = '466d0082-841f-46c7-ae96-5c517da59269'; -- CLI3532: Ahmed Nagar / Maharashtra
update public.units set billing_city = 'Ahmednagar', billing_state = 'Maharashtra' where id = '20f61f5f-46be-4647-bdd5-684465399d69'; -- CLI3542: Ahmed Nagar / Maharashtra
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = 'ccf9daa1-5de6-4711-95a5-82fbbfe3d22b'; -- CLI3647:  / Pune
update public.units set billing_city = 'Amreli', billing_state = 'Gujarat' where id = 'c9b7a710-db42-489b-8fa8-9de6e2ce4b62'; -- CLI3664: Dist- Amreli / Gujarat- 362730
update public.units set billing_city = 'Maharashtra 431210.', billing_state = 'Maharashtra' where id = '4882ffc5-b694-46f5-9bc0-6f158970998d'; -- CLI3682: Maharashtra 431210. / Cidco
update public.units set billing_city = 'Jalna', billing_state = 'Maharashtra' where id = '65dd2eb7-3dce-4d3d-84a7-a522d2692187'; -- CLI3683: Maharashtra- 431211 / Kumbhar Pimpalgaon
update public.units set billing_city = 'Nashik', billing_state = 'Maharashtra' where id = '9635f7ba-6f72-4b16-9077-014afdabc6f7'; -- CLI3686: 422002 / Mg Road Nashik
update public.units set billing_city = 'Gir Somnath', billing_state = 'Gujarat' where id = 'a7576a67-a930-408e-9bab-2fccc953f094'; -- CLI3692: Girmnath / Gujarat
update public.units set billing_city = 'Devbhoomi Dwarka', billing_state = 'Gujarat' where id = '62503f72-c321-42ba-829b-3a9d19acb35a'; -- CLI3700: Devbhoomi Dwerka / Gujarat
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = '4c21f7d1-c01e-4b0b-96ec-fd34ca69bbff'; -- CLI3711: Surendra Nagar / Gujarat
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = '24869272-006c-4505-b3ef-a9c6e7c97b4f'; -- CLI3721: Raigarh(Mh) / Maharashtra
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = '290fb32b-bab8-46bc-b903-d22cd912c860'; -- CLI3722: Raigarh(Mh) / Maharashtra
update public.units set billing_city = 'Chamarajanagar', billing_state = 'Karnataka' where id = '38d4f099-05f3-4c7d-9fd1-e2f0e1980363'; -- CLI3770: Chamrajnagar / Karnataka
update public.units set billing_city = 'Gir Somnath', billing_state = 'Gujarat' where id = 'a7b8283a-6d75-453b-8bca-d044d2c2d5d6'; -- CLI3781: Girmnath / Gujarat
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = 'a4a07a92-7011-48ee-b168-1387722181e2'; -- CLI3789: Raigarh(Mh) / Maharashtra
update public.units set billing_city = 'Udgir', billing_state = 'Maharashtra' where id = '63c256b3-4f74-4eda-a63a-b0b70b2caddd'; -- CLI3793: Udgir (Latur) / Maharashtra
update public.units set billing_city = 'Sri Ganganagar', billing_state = 'Rajasthan' where id = 'b356d3f2-c7c9-4617-acf0-68ffa66705d7'; -- CLI3796: Sriganga Nagar / Rajasthan
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = 'd2e80c01-2443-4eb3-ac8c-365887513296'; -- CLI3809: Pune Pune / Pune
update public.units set billing_city = 'Solapur', billing_state = 'Maharashtra' where id = 'e2096652-2862-42f9-832b-f66e7e77ee5c'; -- CLI3811: Kegaon Solapur / Sopauur
update public.units set billing_city = 'Ahmedabad', billing_state = 'Gujarat' where id = 'e2993d03-438c-47e5-8e40-e38c6346c1b9'; -- CLI3818: Ahmedabad / Ahmedabad
update public.units set billing_city = 'Botad', billing_state = 'Gujarat' where id = '6fde94c4-2bfd-4495-88e2-b541a97f0186'; -- CLI3824: Botab / Gujarat
update public.units set billing_city = 'Surat', billing_state = 'Gujarat' where id = '596528c8-9d9d-4ef6-b2f7-9dd3ac0cb1a2'; -- CLI3826: 395003 / Sufibaugh
update public.units set billing_city = 'Surat', billing_state = 'Gujarat' where id = '3ad21847-9001-4716-8d5b-0f83b64f2497'; -- CLI3829: 395003 / Shapore
update public.units set billing_city = 'Surat', billing_state = 'Gujarat' where id = '7779e680-d019-4eba-8d0f-34e777a27aaf'; -- CLI3830: 395002 / Surat
update public.units set billing_city = 'Chamarajanagar', billing_state = 'Karnataka' where id = '805fdaea-2faf-4739-a738-d51fc9e7a9ce'; -- CLI3846: Chamrajnagar / Karnataka
update public.units set billing_city = 'Hanumangarh', billing_state = 'Rajasthan' where id = '3b9deb78-db78-4f73-a410-d2796535b13f'; -- CLI3945: Rajasthan / Indian
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = 'f7ee6633-952f-426f-b0a8-4940e2c61935'; -- CLI3850: Ghorpadi / Pune – 411001
update public.units set billing_city = 'Ahmednagar', billing_state = 'Maharashtra' where id = '6a25ccfe-43bb-47f6-b09a-072e23e552d8'; -- CLI3876: Ahmed Nagar / Maharashtra
update public.units set billing_city = 'New Delhi', billing_state = 'Delhi' where id = '82d60f59-ad57-4675-a1bc-0a0b85c01713'; -- UN4466: Narela / Delhi
update public.units set billing_city = 'Jaipur', billing_state = 'Rajasthan' where id = 'eec7c4d8-5562-4fb9-bfb1-464807150fea'; -- CLI3914: Rajasthan - 302012 / Kalwar-Road-Jaipur
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '8a6eda6f-9b34-430c-9bd2-44ff6078b76a'; -- CLI3917: Pune / 410501
update public.units set billing_city = 'Beed', billing_state = 'Maharashtra' where id = 'ffd2100e-8092-48fa-83ef-58ada4746cf1'; -- CLI3918: Taluka – Beed / District – Beed
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = '3c117d86-3500-4f0f-a932-b42ba2a81a05'; -- CLI3927: Lower parel / Mumbai
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '2bffb51d-7cb0-4115-ade1-e5525e3ee470'; -- UN4476: Pune / 
update public.units set billing_city = 'Haveri', billing_state = 'Karnataka' where id = '966db51c-6f76-49ba-b8ad-5f99d1eb55dc'; -- CLI3943: Karnataka- 581205 / Savanur
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = '48a207e6-ca08-4feb-941b-7c16b3d970a6'; -- CLI3932: Surendra Nagar / Gujarat
update public.units set billing_city = 'Ahmednagar', billing_state = 'Maharashtra' where id = 'cf3f4d6a-a925-4543-a646-2d942586a1df'; -- CLI3953: Ahmed Nagar / Maharashtra
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '990b4002-82f3-43fe-a62c-c6973bc1ba07'; -- CLI3955: Kondhwa Road / Pune –
update public.units set billing_city = 'Ahmednagar', billing_state = 'Maharashtra' where id = 'd9dae9c8-2171-46c5-8b62-843f7da6b090'; -- CLI3956: Ahmed Nagar / Maharashtra
update public.units set billing_city = 'Bengaluru', billing_state = 'Karnataka' where id = '3bc57346-8476-418b-81fa-4d397ad14840'; -- CLI3957: Hebbal / Karnataka
update public.units set billing_city = 'Nagarkurnool', billing_state = 'Telangana' where id = '68c69138-7f8e-42c1-9b50-94f8c0956914'; -- CLI3959: Nagar Kurnool / Telangana
update public.units set billing_city = 'Telangana', billing_state = 'Telangana' where id = '78a04b7f-cc4d-45bd-a99b-c7bf2bcbd345'; -- CLI3960: Telangana / Nagar Karnool
update public.units set billing_city = 'Mahabubnagar', billing_state = 'Telangana' where id = '2bb20d0f-4a97-4431-b32f-f71348a9c4d2'; -- CLI3961: Mahabubnagar - 509340 (TG) / Telangana
update public.units set billing_city = 'Navi Mumbai', billing_state = 'Maharashtra' where id = '038605f3-0643-4a2a-a16d-156b77a3bd21'; -- CLI3982: Sector 19A / Neel Sidhi Atlantis
update public.units set billing_city = 'Gandhinagar', billing_state = 'Gujarat' where id = 'c5992254-e5b2-4666-848f-1ff3090386b7'; -- CLI3984: Gandhi Nagar / Gujarat
update public.units set billing_city = 'South Goa', billing_state = 'Goa' where id = '30f4b4ea-9b11-4dd9-b1d1-4c44326ba06f'; -- CLI402: Goa / Goa
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '86d32f05-adfa-4e0e-a734-2212409d4c17'; -- CLI4024: LODHA BELLA VITA / Pune
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = 'fa797a8a-6216-44f9-9a99-d20c74888289'; -- CLI4029: Surendra Nagar / Gujarat
update public.units set billing_city = 'Nagaur', billing_state = 'Rajasthan' where id = 'c34805ff-c96b-4ac0-ba41-b1594fec6993'; -- CLI4058: Naguar / Rajasthan
update public.units set billing_city = 'Amreli', billing_state = 'Maharashtra' where id = '3f62d684-be02-444a-b5c4-ebb4da1a5421'; -- CLI4061: Gujarat / Maharashtra
update public.units set billing_city = 'Mumbai Suburban', billing_state = 'Maharashtra' where id = 'fbec1056-9c6e-49fa-b86f-33d65f799db1'; -- CLI4412: Mumbai Subueban / Maharashtra
update public.units set billing_city = 'Gurugram', billing_state = 'Haryana' where id = 'c7d7a749-17a6-42a4-bc7d-2321d64bd5ba'; -- CLI4075: Gurgaon / Haryana
update public.units set billing_city = 'Nashik', billing_state = 'Maharashtra' where id = 'dbcc6bc1-8a0a-47fc-af66-95fbf6a0e0df'; -- CLI4099: Pin code 422010 / Upendra Nagar
update public.units set billing_city = 'Bengaluru', billing_state = 'Karnataka' where id = 'e36abbc4-8b2f-4422-9c5b-eb9c345cb09b'; -- CLI4100: K R Puram / Karnataka
update public.units set billing_city = 'Mahabubnagar', billing_state = 'Telangana' where id = 'd1c8f719-925f-4bdd-b8ef-4c1fff0d00f0'; -- CLI4101: Mahabub Nagar / Telangana
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = '44a8133d-5f27-4af0-b868-f27fbcfce280'; -- CLI2921:  / Mumbai
update public.units set billing_city = 'Gandhinagar', billing_state = 'Gujarat' where id = 'ac74597f-b20a-454a-80f2-58b7e613a6f3'; -- CLI4110: Gandhi Nagar / Gujarat
update public.units set billing_city = 'Devbhoomi Dwarka', billing_state = 'Gujarat' where id = '4eae756f-f723-410f-8e77-fa5704e4bbab'; -- CLI4134: Devbhoomi Dwerka / Gujarat
update public.units set billing_city = 'Devbhoomi Dwarka', billing_state = 'Gujarat' where id = '2e6d35dd-6729-4c3e-b89d-4bd9daf63044'; -- CLI4136: Devbhoomi Dwerka / Gujarat
update public.units set billing_city = 'Devbhoomi Dwarka', billing_state = 'Gujarat' where id = '35783006-deab-49b8-902c-753a8325f783'; -- CLI4137: Devbhoomi Dwerka / Gujarat
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '49372cb1-2aac-4675-87d2-44474e5ce3cc'; -- CLI4155: Clover Hills plaza / Pune
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '2bc0fa6d-6c08-4c76-a8f8-94518f1aac45'; -- CLI4190: Heritage oundation / Pune
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '63622f0e-d0c1-4de1-9b89-ffe0842617b3'; -- CLI4203: H. No. 2 / Yerwada
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = 'c6e7507a-7f3e-4526-91ba-ab0ad4ce859f'; -- CLI4204:  / Mumbai
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = '1c6153d5-d13a-4a3b-b4da-22483ad579aa'; -- CLI4205: Mumbai / Mumbai
update public.units set billing_city = 'Bangalore', billing_state = 'Karnataka' where id = '3fa2302a-9bee-4f6a-8f7b-4ed563bf2965'; -- CLI4228: Banglore / Karnataka
update public.units set billing_city = 'Mumbai Suburban', billing_state = 'Maharashtra' where id = '45c3c13b-90cd-4372-9bbb-53e2c24b1c42'; -- CLI4221: Mumbai Suburban / Mahashtra
update public.units set billing_city = 'Mehsana', billing_state = 'Gujarat' where id = '3b97a537-3f95-429e-8fe1-84748b0f9b65'; -- CLI4234: Mehesana / Gujarat
update public.units set billing_city = 'Sri Ganganagar', billing_state = 'Rajasthan' where id = '7af92e1b-28e9-4406-ae6c-3a1511f1632f'; -- CLI4240: Sri Ganganagar / Rajsthan
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '70f38391-8915-494c-9ce5-a5509a1bf8a0'; -- CLI4255:  / Pune
update public.units set billing_city = 'Surat', billing_state = 'Gujarat' where id = 'efd27335-023f-49c8-bfc8-cc3e1d5a3862'; -- CLI4264: Gujarat / Gujarat
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = 'aac7ec9a-8891-4405-9569-11ef8b231fce'; -- CLI4265: Gujarat / Gujarat
update public.units set billing_city = 'Bangalore', billing_state = 'Karnataka' where id = '439fe268-998c-455b-abc3-e7eb9b4b39e5'; -- CLI4267: Karnataka / Banglore
update public.units set billing_city = 'Nashik', billing_state = 'Maharashtra' where id = '01ff6552-4e59-4ad7-8817-43a8ed5a130a'; -- CLI4289: Nashik / Nashik
update public.units set billing_city = 'Nagaur', billing_state = 'Rajasthan' where id = 'a5548d13-b287-45ee-a359-8fa3c3df90c9'; -- CLI4333:  / Rajasthan
update public.units set billing_city = 'Jaipur', billing_state = 'Rajasthan' where id = '38119c95-e28f-4bc5-b70c-99d09345fde1'; -- CLI4338: Rajasthan / Rajasthan
update public.units set billing_city = 'Sangli', billing_state = 'Maharashtra' where id = '6ff61777-ba99-4b34-8b32-5d4cfdd1a1e1'; -- CLI4345: Maharashtra / Indian
update public.units set billing_city = 'Jalgaon', billing_state = 'Maharashtra' where id = '2e2d4318-6af4-4c64-b212-d8296bd9302a'; -- CLI4348: Maharashtra / Indian
update public.units set billing_city = 'Karnataka', billing_state = 'Karnataka' where id = '9a73534c-ec32-4b93-b17d-7ac15052f7a7'; -- CLI4349: Karnataka / Indian
update public.units set billing_city = 'Bengaluru', billing_state = 'Karnataka' where id = '78e0be4f-92fe-4f02-9cd6-e6d73f0d381c'; -- CLI4351: Mudalpalya / Karnataka
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = '2934a33b-8b91-4e27-854e-828eaf5d812e'; -- CLI4381: Raigarh(Mh) / Maharashtra
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '8ad2daf2-ede9-4faf-840e-7c1a77d4472d'; -- CLI4385: Dhole Patil Road / Pune - 411001
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '0e222b12-a659-43cf-9930-6949c48bdde0'; -- CLI4386: Dhole Patil Road / Pune - 411001
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = 'a5736631-af56-4424-b4dd-55e26f417478'; -- CLI4387: Dhole Patil Road / Pune - 411001
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '9e4ef0df-9f3a-4d23-8e67-ef396680b3a1'; -- CLI4388: Dhole Patil Road / Pune - 411001
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = 'fe05ea3f-df82-4299-b6ec-dbe96ba10b80'; -- CLI4393: Lower Parel / Mumbai
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = 'f12be1b8-8e7a-4922-be9e-1192229faf9a'; -- CLI4403: Raigarh(Mh) / Maharashtra
update public.units set billing_city = 'Thane', billing_state = 'Maharashtra' where id = 'd1c8ba74-0290-4ff6-8237-af0ae8ce84a6'; -- CLI4409: Thane / Thane
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = '9c3de469-7f37-4a77-9912-2a2e5c18fa15'; -- CLI4425: Surendra Nagar / Gujarat
update public.units set billing_city = 'Mumbai', billing_state = 'Maharashtra' where id = '8b0791fa-2aa4-4d51-9674-600cf5b3aa75'; -- CLI4449: Bandra / Mumbai
update public.units set billing_city = 'Pune', billing_state = 'Maharashtra' where id = '1e174e90-d9b7-405e-ae48-0e5f9c57abf0'; -- CLI4464: 410501. / Maharashtra
update public.units set billing_city = 'Ahmednagar', billing_state = 'Maharashtra' where id = '8af25e37-b4dc-4712-befc-8098ca9c938b'; -- CLI521: Ahmed Nagar / Maharashtra
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = 'abdd705e-33f0-480f-a5c8-fcd929af3322'; -- CLI617: Raigadh / Maharashtra
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = 'd4c98d75-8332-4f1f-919c-4a5f4e2b757c'; -- CLI618: Raigadh / Maharashtra
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = 'c7958862-e8d1-4dd6-b2dd-3afb9316a624'; -- CLI619: Raigadh / Maharashtra
update public.units set billing_city = 'Raigarh', billing_state = 'Maharashtra' where id = '0953b130-cc7f-4c08-8cc0-ce2b8420c9a0'; -- CLI621: Raigadh / Maharashtra
update public.units set billing_city = 'Savadatti', billing_state = 'Karnataka' where id = '285c388a-17d0-4b20-b3fb-6ff3ee9376d1'; -- CLI985: Soundatti / Karnataka
update public.units set billing_city = 'Vijayapura', billing_state = 'Karnataka' where id = '695ddf04-86e3-4e26-a207-ed194fef6e6c'; -- CLI4502: Vijayapur / Karnataka
update public.units set billing_city = 'Mysuru', billing_state = 'Karnataka' where id = 'eba7dccc-a730-4fd9-8992-62cf0fdff46c'; -- CLI4215: K R Nagar / Karnataka
update public.units set billing_city = 'Mumbai Suburban', billing_state = 'Maharashtra' where id = 'aec1d317-80fd-42cf-b71c-7f3688bf5b46'; -- CLI4276: Mumbai Suburban / Mahashtra
update public.units set billing_city = 'Thane', billing_state = 'Maharashtra' where id = 'f98aafbb-d26a-432d-946e-49df07753cff'; -- CLI4277: Thane / Mahashtra
update public.units set billing_city = 'Palghar', billing_state = 'Maharashtra' where id = '372cb9d0-bb59-4f47-85d4-f96e66510a01'; -- CLI4278: Palghar / Mahashtra
update public.units set billing_city = 'Palghar', billing_state = 'Maharashtra' where id = '0f537943-9087-4e35-a74c-e9b604604bf3'; -- CLI4279: Palghar / Mahashtra
update public.units set billing_city = 'Palghar', billing_state = 'Maharashtra' where id = 'ce44235c-20d8-4ab4-b285-7bcd76c532c3'; -- CLI4280: Palghar / Mahashtra
update public.units set billing_city = 'Palghar', billing_state = 'Maharashtra' where id = '86e81af4-2450-47b5-bbe4-e1bb96dd71bb'; -- CLI4281: Palghar / Mahashtra
update public.units set billing_city = 'Mundagod', billing_state = 'Karnataka' where id = 'b0944435-a5c1-4677-a342-42a509ffb2de'; -- CLI4296: Mundagod / Uttara Kannada
update public.units set billing_city = 'Digdoh', billing_state = 'Maharashtra' where id = '35d191c4-fadb-411c-b42d-aed6f5e8cd1e'; -- CLI4438: Digdoh / Nagpur
update public.units set billing_city = 'Sangli', billing_state = 'Maharashtra' where id = '04e47243-7784-427b-b321-06951c83f89c'; -- CLI4320: Miraj / Maharashtra
update public.units set billing_city = 'Jodhpur', billing_state = 'Rajasthan' where id = '6ff45cfe-2283-4c4b-9140-12d8dc305768'; -- CLI4323: Rajasthan / India
update public.units set billing_city = 'Sikar', billing_state = 'Rajasthan' where id = '7f61424c-f90b-41aa-86dc-5135abff1306'; -- CLI4326: Rajasthan / Rajasthan
update public.units set billing_city = '', billing_state = 'Rajasthan' where id = '564aed8e-52af-4699-8e5e-8abdc0d412d6'; -- CLI4341:  / Indian
update public.units set billing_city = 'Nagaur', billing_state = 'Rajasthan' where id = '4ca122f6-82ca-4e96-a433-49d7ce869972'; -- CLI4344: Rajasthan / Indian
update public.units set billing_city = 'Mumbai Suburban', billing_state = 'Maharashtra' where id = '8e815700-9faa-408c-a8b8-15e4fd651ddb'; -- CLI4408: Mumbai Subueban / Maharashtra
update public.units set billing_city = 'Akola', billing_state = 'Maharashtra' where id = '7346e70d-2db6-4a4a-b376-600c198db3c8'; -- CLI4435: Akola / Akola
update public.units set billing_city = 'Thorrur', billing_state = 'Telangana' where id = '82476c35-bc81-4374-b43f-8b15b060e9df'; -- CLI4446: Thorrur / Mohabbat
update public.units set billing_city = 'Bangalore Rural', billing_state = 'Karnataka' where id = '73516022-f77b-4674-a7e8-ed878cc9356e'; -- CLI4453: Karnataka / Karnataka
update public.units set billing_city = 'Dharwad', billing_state = 'Karnataka' where id = '034824b2-79f8-4f50-b8d3-a1d140b336b6'; -- CLI4454: Karnataka / Karnataka
update public.units set billing_city = 'Rajkot', billing_state = 'Gujarat' where id = '96fa83a9-7eab-4008-b288-05e5e56483ca'; -- CLI4456: Rajkot / Gujrat
update public.units set billing_city = 'Surendranagar', billing_state = 'Gujarat' where id = '476ac3a4-e009-4f16-8c03-349dae2fb47c'; -- CLI4458: Surendra Nagar / Gujarat
update public.units set billing_city = 'Banaskantha', billing_state = 'Gujarat' where id = '98191986-b81c-4f38-8697-bfb377fb760f'; -- CLI4460: Banaskantha / Gujrat
update public.units set billing_city = 'Valsad', billing_state = 'Gujarat' where id = '5a73fb77-cfa6-4e1d-9a81-be2b5a90bd2a'; -- CLI4462: Valsad / Gujrat
update public.units set billing_city = 'Jaipur', billing_state = 'Rajasthan' where id = 'db1be167-d1ba-4a62-b7ff-4b6939024138'; -- CLI3916: Rajasthan – 302020 / Jaipur Mansarovar
update public.units set billing_city = 'Rajastan', billing_state = 'Rajasthan' where id = 'cbc37aed-7588-4ff0-825a-11a236febe0b'; -- CLI4020: Rajastan / Anupgarh
update public.units set billing_city = 'Nashik', billing_state = 'Rajasthan' where id = '2b747952-b0a9-4b7b-8adf-03be6d5d8250'; -- CLI4347:  / Rajasthan
update public.units set billing_city = 'Bengaluru', billing_state = 'Karnataka' where id = '03005c83-1641-4791-93c2-be10536cfad7'; -- CLI4017: Mudalpalya / Karnataka
update public.units set billing_city = 'Jhujhunu', billing_state = 'Rajasthan' where id = '37f3ec2a-cf6d-4ad4-96e2-4457d916521e'; -- CLI3908: Rajasthan-333001 / Bhiwadi
update public.units set billing_city = 'Udaipur', billing_state = 'Rajasthan' where id = 'fedd9f3c-e7c6-46d8-8901-b020840f1cd6'; -- CLI3910: rajasthan - 313001 / Makrana
update public.units set billing_city = 'Laxmangarh', billing_state = 'Rajasthan' where id = 'd6cc7406-14d0-420b-b2f8-c463a2486ffc'; -- CLI3904: Laxmangarh Sikar / Rajashatan
update public.units set billing_city = 'Ajmer', billing_state = 'Rajasthan' where id = '685ff863-daba-46cf-a7c6-a718e6a46364'; -- CLI3913: Rajasthan - 305801 / Kishangarh Ajmer
update public.units set billing_city = 'Tonk', billing_state = 'Rajasthan' where id = '149d6332-f63b-4201-92c8-1915126c7043'; -- CLI3905: Rajasthan- 304001 / Tonk
update public.units set billing_city = 'Jaipur', billing_state = 'Rajasthan' where id = '2f3a81ae-e3eb-4bd3-bcc5-a5d7aec8a47e'; -- CLI3912: Rajasthan 302004 / Rajapark Jaipur
update public.units set billing_city = 'Bengaluru', billing_state = 'Karnataka' where id = '2b21b72c-bb92-4956-8b03-96c7bb3a1526'; -- CLI2858: Hoodi / Bangalore
update public.units set billing_city = 'Bengaluru', billing_state = 'Karnataka' where id = 'b0ba87e2-1f7b-4a35-a5f4-36a8c9be136a'; -- CLI4283: Bengaluru Urban / Karnataka
update public.units set billing_city = 'Jhujhunu', billing_state = 'Rajasthan' where id = '8c6d3c74-c4b2-4ca4-88f1-a71ab05de973'; -- CLI4363: Rajasthan-333001 / Bhiwadi
update public.units set billing_city = 'Bengaluru', billing_state = 'Karnataka' where id = '078d6ffe-c90c-4f46-b038-adcf193e8927'; -- CLI4284: Bengaluru Urban / Karnataka
update public.units set billing_city = 'Jaipur', billing_state = 'Rajasthan' where id = 'bbee513a-6fb3-4e04-8a16-47660a6ab5e2'; -- CLI4346: Rajasthan / Indian
update public.units set billing_city = 'Jodhpur', billing_state = 'Rajasthan' where id = '3dbac13f-6a37-4df0-864a-aceb8a14232d'; -- CLI4172: Rajasthan 342015. / Banar
update public.units set billing_city = 'Kishangarh', billing_state = 'Rajasthan' where id = '5c2f02e7-aab5-4863-8ae6-af7adb80634a'; -- CLI4359: Kishangarh Ajmer / Rajasthan
update public.units set billing_city = 'Makrana', billing_state = 'Rajasthan' where id = '75f227ed-551a-4eec-95de-ae8dabd9b8a1'; -- CLI4361: Makarana / Rajsthan
update public.units set billing_city = 'Athani', billing_state = 'Karnataka' where id = 'cc6ac107-6ec8-4706-bfae-d701ee12822c'; -- CLI9937: Belgavi Athani / karnataka
update public.units set billing_city = 'Jaipur', billing_state = 'Rajasthan' where id = '9611543a-d781-4a63-8cbb-378930fb5ac9'; -- CLI4343: Rajasthan / Indian
update public.units set billing_city = 'Tonk', billing_state = 'Rajasthan' where id = '043a5dd7-6c7e-4ae1-bb8e-2a308048d64c'; -- CLI4365: Rajasthan- 304001 / Tonk
update public.units set billing_city = 'Laxmangarh', billing_state = 'Rajasthan' where id = '779a362d-7208-4be7-9ceb-1876068cf741'; -- CLI4366: Laxmangarh Sikar / Rajasthan

commit;
