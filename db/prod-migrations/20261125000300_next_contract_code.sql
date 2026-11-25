-- 20261125000300_next_contract_code.sql
-- RISK: LOW - apply now (new function only).
--
-- CLOSES: L31 (contract approval broken for all new contracts). The browser
--   computed the next CON code from a 1,000-row capped fetch of 7,000+ codes and
--   produced an existing code -> unique violation. src/lib/contract-codes.ts
--   (generateNextContractCode) already calls rpc('next_contract_code') first and
--   falls back to paging all codes when the RPC is missing, so no app change is
--   needed for this file.
--
-- BEHAVIOUR: returns 'CON' || lpad(max numeric suffix + 1, 5, '0') over ALL
--   client_contracts rows (SECURITY DEFINER, so RLS cannot hide rows).
--   NOTE vs. the brief: the brief said match '^CON[0-9]+$'. The app helper
--   (nextContractCodeFrom) deliberately counts prefix-anchored codes too, e.g.
--   CON16729A counts as 16729, and pads to 5 digits. This function mirrors the app
--   ('^CON([0-9]+)', case-insensitive) so the RPC and the fallback can never
--   disagree; it can only ever return a number >= the strict-regex result.
--   Concurrency: two simultaneous approvals can receive the same code; the
--   unique constraint rejects the second and withFreshContractCode retries
--   (up to 3 times) with a fresh code.
--
-- AFFECTED SCREENS / ROLES: Client Contracts -> Approve (ContractApprovalDialog).
--   Read-only for everyone else. Reveals only the next code number.
--
-- VERIFY AFTER APPLYING:
--   SELECT public.next_contract_code();   -- e.g. CON16730 (one above the live max)
--   SELECT max((substring(contract_code from '(?i)^CON([0-9]+)'))::bigint) FROM public.client_contracts;
--   Approve a pending contract (e.g. PROS-0003/PROS-0004) -> succeeds with that code.

BEGIN;

CREATE OR REPLACE FUNCTION public.next_contract_code()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'CON' || lpad((COALESCE(max((substring(cc.contract_code FROM '^[Cc][Oo][Nn]([0-9]+)'))::bigint), 0) + 1)::text, 5, '0')
  FROM public.client_contracts cc
  WHERE cc.contract_code ~* '^CON[0-9]+';
$$;

REVOKE ALL ON FUNCTION public.next_contract_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_contract_code() TO authenticated, service_role;

COMMIT;

-- ======================================================================
-- ROLLBACK (run manually). The function did not exist before this migration.
-- The app falls back to paging every code when the RPC is missing.
-- ======================================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.next_contract_code();
-- COMMIT;
