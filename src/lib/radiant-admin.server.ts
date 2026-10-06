// Server-only privileged client bound to the Radiant production database.
//
// The generated `client.server.ts` reads `process.env.SUPABASE_URL` with dot
// access, which the deploy build can bake in at build time with the platform's
// preview backend values. On the live site that silently pointed privileged
// lookups (OTP registration check, account restore, nightly syncs) at an
// empty database. This client reads the pinned production binding directly.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { PRODUCTION_SUPABASE } from "@/lib/server-env";

function createRadiantAdminClient() {
  return createClient<Database>(
    PRODUCTION_SUPABASE["SUPABASE_URL"],
    PRODUCTION_SUPABASE["SUPABASE_SERVICE_ROLE_KEY"],
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

let client: ReturnType<typeof createRadiantAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createRadiantAdminClient>, {
  get(_, prop, receiver) {
    if (!client) client = createRadiantAdminClient();
    return Reflect.get(client, prop, receiver);
  },
});
