-- L&T Finance Gold Loan MIS: create missing employees with date of joining
BEGIN;

WITH incoming(employee_code, full_name, doj) AS (
  VALUES
  ('45141', 'KATARA SURESHBHAI RAMESHBHAI', DATE '2025-10-21'),
  ('45156', 'Siddharajsinh Kakalsinh Rathod', DATE '2025-11-10'),
  ('45089', 'Parmar Jitendrabhai Palabhai', DATE '2025-10-27'),
  ('40603', 'Gamit Kirtikant', DATE '2024-12-16'),
  ('45624', 'Vadher Ketan Kanaiyalal', DATE '2025-12-06'),
  ('44861', 'Mohana Kumara P', DATE '2025-10-16'),
  ('44041', 'Shivaraju', DATE '2025-10-16'),
  ('44922', 'Pradeep Kumar U K', DATE '2025-10-21'),
  ('45126', 'Bikram Thapa', DATE '2025-11-01'),
  ('44875', 'Hanamantappa S Totad', DATE '2025-10-20'),
  ('44986', 'Jitu Gogoi', DATE '2025-10-27'),
  ('40613', 'Venkatesh R', DATE '2024-12-17'),
  ('44945', 'Amarjeet Singh', DATE '2025-10-24'),
  ('44983', 'Mahipal Singh', DATE '2025-10-29'),
  ('44969', 'Selendra Kumar', DATE '2025-10-25'),
  ('45491', 'Ashok Singh', DATE '2025-11-29'),
  ('45468', 'Naveen Jajodiya', DATE '2025-11-28'),
  ('45393', 'Ghanshyam Singh', DATE '2025-11-25'),
  ('45483', 'ajay pal', DATE '2025-11-26'),
  ('45885', 'Nathu Singh', DATE '2025-12-20'),
  ('43073', 'Rahul', DATE '2025-06-16'),
  ('45915', 'Ram Prasad Meena', DATE '2025-12-01'),
  ('45902', 'Sanwar Mal', DATE '2025-12-01'),
  ('45901', 'Devraj Sherdiya', DATE '2025-12-24'),
  ('45918', 'Abhishek Rana', DATE '2025-12-21'),
  ('45837', 'Dinesh Singh', DATE '2025-12-03'),
  ('45905', 'Laxman Singh', DATE '2025-12-23'),
  ('45695', 'Sushil Singh Chauhan', DATE '2025-12-01'),
  ('45807', 'Karu Lal Kumawat', DATE '2025-12-01'),
  ('45895', 'Devesh Kumar Upadhyay', DATE '2025-12-22'),
  ('45215', 'Siri Ranjay Sarma', DATE '2025-11-01'),
  ('45629', 'Sanjay Kumar Mishra', DATE '2025-12-01'),
  ('43715', 'Govindbhai Sedhabhai Senma', DATE '2025-09-30'),
  ('46216', 'Kishor', DATE '2017-06-26'),
  ('35235', 'Paresh', DATE '2022-05-14'),
  ('46173', 'Venkateshaiah D', DATE '2024-03-29'),
  ('46279', 'Vikram', DATE '2026-03-13'),
  ('43976', 'Laxman Shalik Patil', DATE '2025-08-18'),
  ('49271', 'Jaya Sagar', DATE '2022-05-14'),
  ('49272', 'Akash Kannake', DATE '2026-06-30'),
  ('49273', 'Kishor Deshmukh', DATE '2026-06-30')
)
INSERT INTO public.candidates (employee_code, full_name, preferred_joining_date, status, is_enabled, application_date)
SELECT i.employee_code, i.full_name, i.doj, 'active', true, i.doj
FROM incoming i
WHERE NOT EXISTS (
  SELECT 1 FROM public.candidates c WHERE c.employee_code = i.employee_code
);

COMMIT;
