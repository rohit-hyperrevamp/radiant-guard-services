import { describe, expect, it } from 'vitest';
import { indiaDate, locationFreshness, trackingEligible, usableLocationFix } from './work-location';
describe('recorded work locations', () => {
  it('uses the office day in India across midnight UTC', () => { expect(indiaDate(new Date('2026-11-23T21:57:00Z'))).toBe('2026-11-24'); });
  it('distinguishes guard check-in GPS from moving live locations', () => { expect(locationFreshness({ located_at: '2026-11-24T00:00:00Z', location_source: 'check_in' })).toBe('check_in'); });
  it('does not label old device fixes live', () => { expect(locationFreshness({ located_at: '2026-11-24T00:00:00Z', location_source: 'telemetry' }, new Date('2026-11-24T00:03:00Z').getTime())).toBe('stale'); });
  it('enables transport drivers but not the transport manager collector', () => { expect(trackingEligible('transport','Driver')).toBe(true); expect(trackingEligible('transport','Manager')).toBe(false); });
  it('rejects repeated stale positions and inaccurate readings', () => { expect(usableLocationFix(1_000,20,100_000)).toBe(false); expect(usableLocationFix(100_000,188_617,100_001)).toBe(false); expect(usableLocationFix(100_000,20,100_001)).toBe(true); });
});