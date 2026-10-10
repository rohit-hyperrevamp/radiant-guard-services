import { mock } from "bun:test";
import { supabase } from "./shim";
mock.module("@/integrations/supabase/client", () => ({ supabase }));
