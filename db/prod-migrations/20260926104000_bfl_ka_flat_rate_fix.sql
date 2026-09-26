-- Karnataka BFL: all active 8h Security Guard posts on the flat ₹28,903.17 structure
-- (copy components/contributions/deductions/benefits/gross from the reference post CON16081).
update public.contract_resources r
set components=s.components, employer_contributions=s.employer_contributions,
    deductions=s.deductions, benefits=s.benefits, gross=s.gross, updated_at=now()
from public.contract_resources s
where s.id='1f2554fe-3a50-4bc4-bf56-8eac49f55d01'
  and r.id in ('fedacd1d-7055-40fe-a020-006463e27d80','93852b11-4b3d-4b01-8841-55547aa571c0',
    'a89389de-3cbb-4eb0-828a-e238f93a2ad8','6ab41990-046d-498b-b0d2-972330e3dfe8',
    'e7a8fa9e-5eaf-47de-b4f7-4399ad63a95b','b2568dd8-8963-4de7-b9f3-b85b20b53fd1',
    'a6161e00-1713-4602-bb41-bf22b09be1f3','ca7c55ee-ff18-4c1a-860f-06046808a084',
    'f65e3941-aaf7-435f-9925-94811176b235','17d0e475-3014-4f6d-ba90-05e26c68a6c6');
