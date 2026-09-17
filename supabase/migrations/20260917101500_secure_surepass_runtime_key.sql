CREATE OR REPLACE FUNCTION public.get_surepass_api_key()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'surepass_api_key'
  ORDER BY created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_surepass_api_key() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_surepass_api_key() TO service_role;
