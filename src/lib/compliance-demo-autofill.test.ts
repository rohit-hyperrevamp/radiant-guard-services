import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { employeeAutofillFacts, contextualAutofillFacts, autoFillDigital, ageAtMonthEnd } from './compliance-autofill';
import { digitalFieldLines, digitalKey, type DigitalForm } from './compliance-digital';
import { reviewedDigitalLayout, ANSWER_SIZE } from './compliance-reviewed-layout';

const ids = readdirSync('public/compliance-digital').filter(f => /^compliance-\d+\.json$/.test(f)).map(f => f.replace('.json', '')).sort();
const load = (id: string): DigitalForm => reviewedDigitalLayout(JSON.parse(readFileSync(`public/compliance-digital/${id}.json`, 'utf8')));
const employee = { id: 'demo', full_name: 'Demo Ramesh Patil', employee_code: 'DEMO-1', designation: 'Security Guard', date_of_birth: '1994-06-12', preferred_joining_date: '2025-02-01', gender: 'Male', permanent_address1: 'Flat 12', permanent_city: 'Pune', compliance: { uan: '100200300400', esic_number: '3100200300' }, other_info: { father_name: 'Demo Shankar Patil' } };
const employer = { company_name: 'Radiant Guard Services Pvt. Ltd.', registered_address: 'Kondhwa, Pune 411048', pf_number: 'PUPUN0012345', esic_number: '33000123450000999' };

describe('demo employee fills every reviewed compliance form', () => {
  it('all 45 forms fill at least one saved fact for a selected employee, month and site', () => {
    expect(ids).toHaveLength(45);
    const facts = { ...employeeAutofillFacts(employee, employer), ...contextualAutofillFacts('2026-10', { name: 'Demo Site', code: 'CLI9999', address: 'Pune' }, [], [], 'demo') };
    for (const id of ids) expect(Object.keys(autoFillDigital(load(id), facts)).length, id).toBeGreaterThan(0);
  });
  it('every answer uses one consistent size', () => {
    for (const id of ids) for (const p of load(id).pages) for (const f of p.fields) expect(f.size).toBe(ANSWER_SIZE);
  });
  it('combined name-and-address facts include the saved address', () => {
    const facts = employeeAutofillFacts(employee, employer);
    expect(facts.employeeNameAddress).toBe('Demo Ramesh Patil, Flat 12, Pune');
    expect(facts.employerNameAddress).toBe('Radiant Guard Services Pvt. Ltd., Kondhwa, Pune 411048');
  });
  it('employer registration codes never fill monthly PF/ESIC amount blanks', () => {
    const facts = employeeAutofillFacts(employee, employer);
    expect(facts.employerPfCode).toBe('PUPUN0012345');
    expect(facts.employerEsicCode).toBe('33000123450000999');
    expect(facts.employerPf).toBeUndefined();
    expect(facts.employerEsic).toBeUndefined();
  });
  it('wage slip PF and ESI answers sit beside, not over, their printed labels', () => {
    const page = load('compliance-30').pages[0];
    expect(page.fields.find(f => f.id === 'review-employee-esic')!.box[0]).toBeGreaterThanOrEqual(351);
  });
  it('age is completed years at the selected month end', () => {
    expect(ageAtMonthEnd('1994-06-12', '2026-05')).toBe('31');
    expect(ageAtMonthEnd('1994-06-12', '2026-06')).toBe('32');
    expect(ageAtMonthEnd('', '2026-06')).toBe('');
  });
  it('shrinks text before splitting a word', () => {
    const measure = (t: string, s: number) => t.length * s * .5;
    const fitted = digitalFieldLines('Male', [0, 0, 10, 30], 8, measure);
    expect(fitted.lines).toEqual(['Male']);
    expect(digitalKey(0, 'x')).toBe('0:x');
  });
});
