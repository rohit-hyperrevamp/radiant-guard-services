-- Contracts on the Sept invoice review that showed as not active (expiry in the past): extend to 1 Dec 2026.
UPDATE public.client_contracts cc SET
  expiry_date = '2026-12-01',
  end_date = CASE WHEN cc.end_date IS NULL OR cc.end_date < '2026-12-01' THEN '2026-12-01'::date ELSE cc.end_date END,
  updated_at = now()
FROM public.units u
WHERE u.id = cc.unit_id AND u.code IN ('CLI3556','CLI3815','CLI3814','CLI3463','CLI4150','CLI2285','CLI2283','CLI3818','CLI3347','CLI3347')
  AND (coalesce(cc.expiry_date, cc.end_date) < '2026-12-01');
