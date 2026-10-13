export { supabase } from "./shim";
import postgres from "postgres";
export const db = postgres(process.env.RADIANT_PROD_DB_URL!, { max: 4 });
