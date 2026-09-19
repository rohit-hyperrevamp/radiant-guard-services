-- Assign operational zones to L&T Finance units based on billing state
-- (with city/pincode overrides for rows where billing_state holds a typo or city name).
-- Mapping: Gujarat -> Central, Karnataka -> South 3, Rajasthan -> North,
--          Telangana -> South 1, Maharashtra -> West.

update public.units u
set zone = case
  when lower(trim(u.billing_state)) in ('gujarat', 'gujrat')
    then 'Central'
  when lower(trim(u.billing_state)) in ('karnataka', 'bangalore', 'uttara kannada')
    then 'South 3'
  when lower(trim(u.billing_state)) in (
    'rajasthan', 'rajsthan', 'rajashatan', 'bhiwadi', 'tonk', 'anupgarh',
    'banar', 'makrana', 'rajapark jaipur', 'jaipur mansarovar',
    'kishangarh ajmer', 'kalwar-road-jaipur'
  ) then 'North'
  when lower(trim(u.billing_state)) = 'telangana'
    then 'South 1'
  when lower(trim(u.billing_state)) in ('maharashtra', 'mahashtra', 'nagpur', 'nashik', 'mumbai', 'akola')
    then 'West'
  -- Rows where billing_state holds 'Indian'/'India'/'Mohabbat': resolve via billing city/pincode
  when lower(trim(u.billing_city)) in ('rajasthan') then 'North'
  when lower(trim(u.billing_city)) in ('maharashtra') then 'West'
  when lower(trim(u.billing_city)) in ('karnataka') then 'South 3'
  when u.billing_pincode like '506%' then 'South 1'   -- Thorrur, Telangana
  when u.billing_pincode like '3%' then 'North'        -- Jaipur-region pincodes
  else u.zone
end
where u.customer_id = '77ddd7f3-bd79-4453-b0d7-f7e533687353';
