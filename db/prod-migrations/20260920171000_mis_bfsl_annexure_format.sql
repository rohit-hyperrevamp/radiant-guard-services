-- MIS billing annexure format for ORG233 Bajaj Financial Securities Limited.

DELETE FROM public.mis_templates WHERE customer_id = '589e6827-8569-4f42-8da5-cc3b870e679e';

INSERT INTO public.mis_templates (id, customer_id, name, enabled, row_grain)
VALUES ('11111111-2233-4455-6677-000000000233', '589e6827-8569-4f42-8da5-cc3b870e679e', 'BFSL Pan India Billing Annexure', true, 'site');

INSERT INTO public.mis_template_columns (id, template_id, header, sort_order, source, system_key, enabled, client_attribute)
VALUES
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'Sr. No.', 1, 'system', 'sr_no', true, false),
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'Vendor Name', 2, 'system', 'vendor_name', true, false),
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'PO Number', 3, 'custom', NULL, true, true),
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'CLI ID', 4, 'system', 'cli_id', true, false),
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'Branch Name', 5, 'system', 'branch_name', true, false),
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'District', 6, 'system', 'district', true, false),
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'State', 7, 'system', 'state', true, false),
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'Location Category', 8, 'custom', NULL, true, true),
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'Pin Code', 9, 'system', 'pin_code', true, false),
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'Address', 10, 'system', 'address', true, false),
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'SG Count', 11, 'system', 'sg_count', true, false),
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'GST No', 12, 'system', 'gst_no', true, false),
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'Invoice Month', 13, 'system', 'invoice_month', true, false),
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'Invoice Date', 14, 'system', 'invoice_date', true, false),
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'Invoice No', 15, 'system', 'invoice_no', true, false),
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'Zone', 16, 'system', 'zone', true, false),
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'Regular SG Rate', 17, 'system', 'regular_rate', true, false),
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'Increment SG Rate', 18, 'system', 'increment_rate', true, false),
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'Month Days', 19, 'system', 'month_days', true, false),
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'Regular SG Duties', 20, 'system', 'regular_duties', true, false),
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'Increment SG Duties', 21, 'system', 'increment_duties', true, false),
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'Regular SG OTs  (Hours)', 22, 'system', 'regular_ot_hours', true, false),
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'Increment SG OTs  (Hours)', 23, 'system', 'increment_ot_hours', true, false),
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'Service Charge Claimed', 24, 'system', 'service_charge_claimed', true, false),
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'GST@18%', 25, 'system', 'gst_18', true, false),
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'Invoice Value', 26, 'system', 'invoice_value', true, false),
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'Total Duties', 27, 'system', 'total_duties', true, false),
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'Total OT HRS', 28, 'system', 'total_ot_hours', true, false),
  (gen_random_uuid(), '11111111-2233-4455-6677-000000000233', 'Remarks', 29, 'custom', NULL, true, true);

INSERT INTO public.mis_unit_values (template_id, column_id, unit_id, value)
SELECT '11111111-2233-4455-6677-000000000233', c.id, u.id, v.value
FROM (VALUES
    ('CLI2544', 'Non PO'),
    ('CLI1703', 'Non PO'),
    ('CLI2625', 'Non PO'),
    ('CLI2989', 'Non PO'),
    ('CLI2064', 'Non PO'),
    ('CLI2991', 'Non PO'),
    ('CLI2737', 'Non PO'),
    ('CLI2060', 'Non PO'),
    ('CLI2342', 'Non PO'),
    ('CLI2930', 'Non PO'),
    ('CLI1421', 'Non PO'),
    ('CLI2736', 'Non PO'),
    ('CLI2343', 'Non PO'),
    ('CLI1979', 'Non PO'),
    ('CLI2537', 'Non PO'),
    ('CLI2063', 'Non PO'),
    ('CLI2066', 'Non PO'),
    ('CLI2538', 'Non PO'),
    ('CLI2061', 'Non PO'),
    ('CLI2138', 'Non PO'),
    ('CLI2222', 'Non PO'),
    ('CLI3053', 'Non PO'),
    ('CLI1408', 'Non PO'),
    ('CLI3452', 'Non PO'),
    ('CLI2345', 'Non PO'),
    ('CLI1745', 'Non PO'),
    ('CLI2068', 'Non PO'),
    ('CLI2371', 'Non PO'),
    ('CLI2908', 'Non PO'),
    ('CLI2023', 'Non PO'),
    ('CLI1635', 'Non PO'),
    ('CLI2067', 'Non PO'),
    ('CLI2065', 'Non PO'),
    ('CLI2922', 'Non PO'),
    ('CLI2535', 'Non PO'),
    ('CLI3223', 'Non PO'),
    ('CLI2344', 'Non PO'),
    ('CLI3077', 'Non PO')
) AS v(code, value)
JOIN public.units u ON u.code = v.code AND u.customer_id = '589e6827-8569-4f42-8da5-cc3b870e679e'
JOIN public.mis_template_columns c
  ON c.template_id = '11111111-2233-4455-6677-000000000233' AND c.header = 'PO Number'
ON CONFLICT (column_id, unit_id) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO public.mis_unit_values (template_id, column_id, unit_id, value)
SELECT '11111111-2233-4455-6677-000000000233', c.id, u.id, v.value
FROM (VALUES
    ('CLI2544', 'Urban'),
    ('CLI1703', 'Urban'),
    ('CLI2625', 'Urban'),
    ('CLI2989', 'Urban'),
    ('CLI2064', 'Urban'),
    ('CLI2991', 'Urban'),
    ('CLI2737', 'Urban'),
    ('CLI2060', 'Urban'),
    ('CLI2342', 'Urban'),
    ('CLI2930', 'Urban'),
    ('CLI1421', 'Urban'),
    ('CLI2736', 'Urban'),
    ('CLI2343', 'Urban'),
    ('CLI1979', 'Urban'),
    ('CLI2537', 'Urban'),
    ('CLI2063', 'Urban'),
    ('CLI2066', 'Urban'),
    ('CLI2538', 'Urban'),
    ('CLI2061', 'Urban'),
    ('CLI2138', 'Urban'),
    ('CLI2222', 'Urban'),
    ('CLI3053', 'Urban'),
    ('CLI1408', 'Urban'),
    ('CLI3452', 'Urban'),
    ('CLI2345', 'Urban'),
    ('CLI1745', 'Urban'),
    ('CLI2068', 'Urban'),
    ('CLI2371', 'Urban'),
    ('CLI2908', 'Urban'),
    ('CLI2023', 'Urban'),
    ('CLI1635', 'Urban'),
    ('CLI2067', 'Urban'),
    ('CLI2065', 'Urban'),
    ('CLI2922', 'Urban'),
    ('CLI2535', 'Urban'),
    ('CLI3223', 'Urban'),
    ('CLI2344', 'Urban'),
    ('CLI3077', 'Urban')
) AS v(code, value)
JOIN public.units u ON u.code = v.code AND u.customer_id = '589e6827-8569-4f42-8da5-cc3b870e679e'
JOIN public.mis_template_columns c
  ON c.template_id = '11111111-2233-4455-6677-000000000233' AND c.header = 'Location Category'
ON CONFLICT (column_id, unit_id) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO public.mis_unit_values (template_id, column_id, unit_id, value)
SELECT '11111111-2233-4455-6677-000000000233', c.id, u.id, v.value
FROM (VALUES
    ('CLI2544', 'Live Branch'),
    ('CLI1703', 'Live Branch'),
    ('CLI2625', 'Live Branch'),
    ('CLI2989', 'Live Branch'),
    ('CLI2064', 'Live Branch'),
    ('CLI2991', 'Live Branch'),
    ('CLI2737', 'Live Branch'),
    ('CLI2060', 'Live Branch'),
    ('CLI2342', 'Live Branch'),
    ('CLI2930', 'Live Branch'),
    ('CLI1421', 'Live Branch'),
    ('CLI2736', 'Live Branch'),
    ('CLI2343', 'Live Branch'),
    ('CLI1979', 'Live Branch'),
    ('CLI2537', 'Live Branch'),
    ('CLI2063', 'Live Branch'),
    ('CLI2066', 'Live Branch'),
    ('CLI2538', 'Live Branch'),
    ('CLI2061', 'Live Branch'),
    ('CLI2138', 'Live Branch'),
    ('CLI2222', 'Live Branch'),
    ('CLI3053', 'Live Branch'),
    ('CLI1408', 'Live Branch'),
    ('CLI3452', 'Live Branch'),
    ('CLI2345', 'Live Branch'),
    ('CLI1745', 'Live Branch'),
    ('CLI2068', 'Live Branch'),
    ('CLI2371', 'Live Branch'),
    ('CLI2908', 'Live Branch'),
    ('CLI2023', 'Live Branch'),
    ('CLI1635', 'Live Branch'),
    ('CLI2067', 'Live Branch'),
    ('CLI2065', 'Live Branch'),
    ('CLI2922', 'Live Branch'),
    ('CLI2535', 'Live Branch'),
    ('CLI3223', 'Live Branch'),
    ('CLI2344', 'Live Branch'),
    ('CLI3077', 'Live Branch')
) AS v(code, value)
JOIN public.units u ON u.code = v.code AND u.customer_id = '589e6827-8569-4f42-8da5-cc3b870e679e'
JOIN public.mis_template_columns c
  ON c.template_id = '11111111-2233-4455-6677-000000000233' AND c.header = 'Remarks'
ON CONFLICT (column_id, unit_id) DO UPDATE SET value = EXCLUDED.value;

UPDATE public.units u SET
  billing_district = CASE WHEN COALESCE(u.billing_district,'') = '' THEN COALESCE(v.district,'') ELSE u.billing_district END,
  billing_pincode  = CASE WHEN COALESCE(u.billing_pincode,'')  = '' THEN COALESCE(v.pincode,'')  ELSE u.billing_pincode END,
  billing_address1 = CASE WHEN COALESCE(u.billing_address1,'') = '' THEN COALESCE(v.address,'')  ELSE u.billing_address1 END,
  gst_number       = CASE WHEN COALESCE(u.gst_number,'')       = '' THEN COALESCE(v.gst,'')      ELSE u.gst_number END
FROM (VALUES
    ('CLI2544', 'Agra', '282002', 'Bajaj Financial Securities Limited, Corporate Park , 4th floor  (behind cosmos mall, Sanjay Place, Civil Lines, Agra, Uttar Pradesh 282002', '09AAECB0643B1Z8'),
    ('CLI1703', 'Ahmedabad', '380054', 'Bajaj Financial Securities Limited, Shilp Epitome,Office No. 503, 504 & 505, 5th Floor, Near Rajpath Club Bodakdev , Ahmedabad -380054', '24AAECB0643B1ZG'),
    ('CLI2625', 'Bhavnagar', '364002', 'Bajaj Financial Securities Limited, Office no. 104  1st floor , Shanti Height , Valentine Circle , Waghawadi Nagar , Bhavnagar -364002', '24AAECB0643B1ZG'),
    ('CLI2989', 'Bhopal', '462011', 'Bajaj Financial Securities Limited, Ambika Orchid, 1st floor, Z-19, Opposite chittod complex, Zone -I,M P Nagar, Bhopal, Madya Pradesh- 462011', '23AAECB0643B2ZH'),
    ('CLI2064', 'Bhubaneshwar', '751007', 'Bajaj Financial Securities Limited, BMC Bhawani Commercial Complex, 4 th Floor, Block-2 ,Saheed Nagar, BHUBANESVER, Odisha 751007', '21AAECB0643B1ZM'),
    ('CLI2991', 'Dehradun', '248001', 'Bajaj Financial Securities Limited, Shri Ram Arcade, 2nd Floor Rajpur Rd, Kandholi, Chironwali, Dehradun, Uttarakhand- 248001', '05AAECB0643B1ZG'),
    ('CLI2737', 'Delhi', '110001', 'Bajaj Financial Securities Limited, 6th Floor, 606, Ashoka Estate, 24 Barakhamba Road, Connaught Palace, NEW DELHI - 110001', '07AAECB0643B1ZC'),
    ('CLI2060', 'Delhi', '110001', 'Bajaj Financial Securities Limited, 7th Floor, 706, Ashoka Estate, 24 Barakhamba Road, Connaught Palace, NEW DELHI - 110001', '07AAECB0643B1ZC'),
    ('CLI2342', 'Pune', '411014', 'Bajaj Financial Securities Limited, Survey No 198, Giga Space IT Park, Nagar Road, Viman Nagar, Pune- 411014', '27AAECB0643B1ZA'),
    ('CLI2930', 'Gorakhpur', '273001', 'Bajaj Financial Securities Limited, Lower Ground Floor, Cross Road, The Mall, Bank Road, Agrasen Chowk, Gorakhpur, Uttar Pradesh 273001', '09AAECB0643B1Z8'),
    ('CLI1421', 'Greater Mumbai', '400063', 'Bajaj Financial Securities Limited, Synergy Business Park, 1st floor, Sahakar Wadi, off Aarey Road, ITT Bhatti, Hanuman Tekdi, Goregaon, Mumbai, Maharashtra- 400063', '27AAECB0643B1ZA'),
    ('CLI2736', 'Greater Mumbai', '400063', 'Bajaj Financial Securities Limited, Synergy Business Park, 7th floor, Sahakar Wadi, off Aarey Road, ITT Bhatti, Hanuman Tekdi, Goregaon, Mumbai, Maharashtra- 400063', '27AAECB0643B3Z8'),
    ('CLI2343', 'Gurugram', '122022', 'Bajaj Financial Securities Limited, Ocus Technopolis, 1st floor Unit No 03A, B&C Golf Course Rd, Suncity, Sector 54, Gurugram, Haryana 122022', '06AAECB0643B1ZE'),
    ('CLI1979', 'Guwahati', '781007', 'Bajaj Financial Securities Limited, 4th floor, Achyut and choudhury complex, Near Hotel Bilas, G S Raod, Guwahati, Kumrup Metropolitan, Assam, 781007', '18AAECB0643B1Z9'),
    ('CLI2537', 'Indore', '452018', 'Bajaj Financial Securities Limited, Shekhar Central ,1st floor , AB road, Manorama Ganj, Indore, Madhya Pradesh-452018', '23AAECB0643B2ZH'),
    ('CLI2063', 'Jaipur', '302001', 'Bajaj Financial Securities Limited, 201- 204, Green House, C-SCHEME, 2nd Floor, GREEN HOUSE, ASHOK Nagar, JAIPUR, RAJASTHAN, India (IN), Pin Code: - 302001', '08AAECB0643B1ZA'),
    ('CLI2066', 'Jamshedpur', '831001', 'Bajaj Financial Securities Limited, Tee Kay Corporate Towers,5th Floor, S.B Shop Area, Bistupur, Jamshedpur,JHARKHAND, 831001', '20AAECB0643B1ZO'),
    ('CLI2538', 'Kanpur', '208001', 'Bajaj Financial Securities Limited, Kan Chamber, 6th  floor , Office  No.612 to 616, 14/113, Civil Lines, Kanpur, Uttar Pradesh- 208001', '09AAECB0643B1Z8'),
    ('CLI2061', 'Kolkata', ' 700016', 'Bajaj Financial Securities Limited, 7th Floor, Office 7A/2, Siddha Park, 99A, Park Street, KOLKATA, West Bengal - 700016', '19AAECB0643B1Z7'),
    ('CLI2138', 'Kota', '324007', 'Bajaj Financial Securities Limited, No.16C/2 Plot, 1St Floor, Near Ghodewala Baba Circle, Vallabh Nagar, Gumanpura, Kota, Rajasthan- 324007', '08AAECB0643B1ZA'),
    ('CLI2222', 'Lucknow', '226010', 'Bajaj Financial Securities Limited, Urbanac Business Park, 4th Floor, Vibhuti Khand, Gomti Nagar, Lucknow, Uttar Pradesh 226010', '09AAECB0643B1Z8'),
    ('CLI3053', 'Ludhiana', '141001', 'Bajaj Financial Securities Limited, Shanghai Tower, 1st floor,CSO 13, Feroze Gandhi Market, Ludhiana-141001.', '03AAECB0643B2ZJ'),
    ('CLI1408', 'Pune', '411003', 'Bajaj Financial Securities Limited, MANTRI IT PARK, NAGAR ROAD, PUNE, MAHARASHTRA- 11003', '27AAECB0643B1ZA'),
    ('CLI3452', 'Greater Mumbai', '400005', 'Bajaj Financial Securities Limited, C& B SQUARE office no. 502, 5th Floor, C.T.S No 95 A , Andheri Kurla Road, Village Chakala, Andheri   ( East), Mumbai 400005', '27AAECB0643B1ZA'),
    ('CLI2345', 'Greater Mumbai', '400063', 'Bajaj Financial Securities Limited, Anupam Annapolis, 3rd floor Peru Baug,   Jay Prakash Nagar, Goregaon, Mumbai, Maharashtra 400063', '27AAECB0643B1ZA'),
    ('CLI1745', 'Nagpur', '440010', 'Bajaj Financial Securities Limited, Ved Solitaire, Cement Road,3rd Floor Dharampeth, Nagpur-440010  .', '27AAECB0643B1ZA'),
    ('CLI2068', 'Patna', '800001', 'Bajaj Financial Securities Limited, Office No 3005, 3rd Floor, Grand Plaza, Mazharul Haque Path, Dak Bunglow, Lodipur, Patna, Bihar 800001', '10AAECB0643B1ZP'),
    ('CLI2371', 'Pune', '411004', 'Bajaj Financial Securities Limited, 96 Suvarnarekha Boulevard 3rd floor Ghodake chowk, Prabhat Rd, Erandwane, Pune, Maharashtra 411004', '27AAECB0643B1ZA'),
    ('CLI2908', 'Gorakhpur', '211001', 'Bajaj Financial Securities Limited, Bajaj Broking, LDA Centre, 1st Floor, Nawab Yusuf Road, Civil Lines, Prayagraj, Uttar Pradesh - 211001', '09AAECB0643B1Z8'),
    ('CLI2023', 'Raipur', '492001', 'Bajaj Financial Securities Limited, 2nd floor, Piyank Tower, Near Oxy Zone, GE Road, Raipur, Raipur, Chhattisgarh- 492001', '22AAECB0643B1ZK'),
    ('CLI1635', 'Rajkot', '360001', 'Bajaj Financial Securities Limited, ANANT THE WORK SPACE,Office no 204, 2nd floor,kalawad main road, RAJKOT- 360001', '24AAECB0643B1ZG'),
    ('CLI2067', 'Ranchi', '834001', 'Bajaj Financial Securities Limited, Office No.104, 107 & 108 , 1st floor,Commerce Tower, M S Plot No.1784, J D Compound, Main Road, Ranchi, Jharkhand-834001', '20AAECB0643B1ZO'),
    ('CLI2065', 'Raurkela', '769012', 'Bajaj Financial Securities Limited, Holding No.72, Plot No.304, Uditnager, Rourkela , Odisha - 769012', '21AAECB0643B1ZM'),
    ('CLI2922', 'Siliguri', '734001', 'Bajaj Financial Securities Limited, Metro Square, 5th floor,Ward 10, Janta Nagar, Siliguri, West Bengal- 734001', '19AAECB0643B1Z7'),
    ('CLI2535', 'Surat', '395007', 'Bajaj Financial Securities Limited, Unity corner , 4th floor , office No -402 City light main road opposite bank of Baroda Surat-395007', '24AAECB0643B1ZG'),
    ('CLI3223', 'Udaipur', '313001', 'Bajaj Financial Securities Limited, 2nd floor No 12/A, Katargam, above HDFC Bank, Udaipur, Rajasthan 313001.', '08AAECB0643B1ZA'),
    ('CLI2344', 'Vadodara', '390023', 'Bajaj Financial Securities Limited, Office No. 105/106,Block-D 1st Floor Notus IT Park, Near Genda circle Sarabhai campus Bhailal ,Amin road Vadodara-390023', '24AAECB0643B1ZG'),
    ('CLI3077', 'Banaras', '221010', 'Bajaj Financial Securities Limited, Jus Maa Complex D58/12 A/ 2 Gandhi Nagar Sigra,Banaras 221010', '09AAECB0643B1Z8')
) AS v(code, district, pincode, address, gst)
WHERE u.code = v.code AND u.customer_id = '589e6827-8569-4f42-8da5-cc3b870e679e';
