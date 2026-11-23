import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client',()=>({supabase:{}}));
vi.mock('@/lib/self-attendance',()=>({distanceMeters:()=>0}));
import { resolveRange } from './field-visits';
afterEach(()=>vi.useRealTimers());
describe('Radar history dates',()=>{
 it('today uses the India office day after midnight, even in a UTC browser',()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-23T21:57:00Z'));expect(resolveRange('today').start).toBe('2026-11-24');});
 it('yesterday gives the preceding India calendar day',()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-23T21:57:00Z'));expect(resolveRange('yesterday').start).toBe('2026-11-23');});
 it('retains an exact custom day from one year ago',()=>{expect(resolveRange('custom','2025-11-24','2025-11-24').start).toBe('2025-11-24');expect(resolveRange('custom','2025-11-24','2025-11-24').end).toBe('2025-11-24');});
});