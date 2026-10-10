import { createClient } from "@supabase/supabase-js";
import { PRODUCTION_SUPABASE } from "@/lib/server-env";
export const supabase = createClient(PRODUCTION_SUPABASE.SUPABASE_URL, PRODUCTION_SUPABASE.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
