import { mock } from "bun:test";
import { supabase } from "../pchk/shim";
mock.module("@/integrations/supabase/client", () => ({ supabase }));
