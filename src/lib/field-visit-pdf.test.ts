import { describe, expect, it, vi } from 'vitest';
import type { DetailedVisit } from './visit-coverage';
vi.mock('./field-visits',()=>({signedProofUrl:vi.fn(async()=>null)}));
import { buildEmployeeVisitPdf } from './field-sense-report-pdf';
const form=(id:string):DetailedVisit=>({id,candidate_id:'demo',unit_id:id,visit_date:'2026-11-24',visit_seq:1,check_in_at:'2026-11-24T10:00:00Z',check_out_at:'2026-11-24T11:00:00Z',check_in_lat:18.46746,check_in_lng:73.90188,check_in_accuracy:10,check_out_lat:18.46746,check_out_lng:73.90188,visit_notes:'Verified work record',customer_rating:5,client_signature_url:null,client_photo_url:null,client_name:null,distance_from_prev_m:null,created_at:'2026-11-24T10:00:00Z',updated_at:'2026-11-24T11:00:00Z',unit_name:'Verification site',unit_code:'VERIFY',customer_name:'Verification organisation'});
describe('employee visit PDF',()=>{
 it('exports both saved forms rather than only the selected site',async()=>{
  const pdf=await buildEmployeeVisitPdf('Verification employee','DEMO','2026-11-24','2026-11-24',[form('one'),form('two')]);
  expect(pdf.getNumberOfPages()).toBe(2);
  expect(pdf.output()).toContain('18.46746, 73.90188');
 });
 it('rejects incomplete PDF generation when saved proof cannot be retrieved',async()=>{
  await expect(buildEmployeeVisitPdf('Verification employee','DEMO','2026-11-24','2026-11-24',[{...form('one'),client_photo_url:'private/recorded-proof.jpg'}])).rejects.toThrow('export stopped');
 });
});