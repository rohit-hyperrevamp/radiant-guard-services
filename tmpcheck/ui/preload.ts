import { GlobalRegistrator } from "/tmp/rt/node_modules/@happy-dom/global-registrator/lib/index.js";
const nf = globalThis.fetch, NH = globalThis.Headers, NReq = globalThis.Request, NRes = globalThis.Response;
GlobalRegistrator.register({ url: "http://localhost/" });
Object.assign(globalThis, { fetch: nf, Headers: NH, Request: NReq, Response: NRes });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
import { mock } from "bun:test";
const { supabase } = await import("../pchk/shim");
mock.module("@/integrations/supabase/client", () => ({ supabase }));
