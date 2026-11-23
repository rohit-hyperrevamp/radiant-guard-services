import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DetailedVisit } from './visit-coverage';
vi.mock('./field-visits',()=>({signedProofUrl:vi.fn(async()=>null)}));
import { buildEmployeeVisitPdf } from './field-sense-report-pdf';
import { signedProofUrl } from './field-visits';
afterEach(()=>{vi.unstubAllGlobals();vi.mocked(signedProofUrl).mockResolvedValue(null);});
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
 it('includes both photo and signature images alongside each saved form',async()=>{
  const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8//8/AwMDEwMDAwMDAwAkBgMB/DXemwAAAABJRU5ErkJggg==';
  vi.mocked(signedProofUrl).mockResolvedValue('https://evidence.invalid/signed-test-image');
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,blob:async()=>new Blob()})));
  vi.stubGlobal('FileReader',class {result=image;onload:(()=>void)|null=null;readAsDataURL(){this.onload?.();}});
  const pdf=await buildEmployeeVisitPdf('Verification employee','DEMO','2026-11-24','2026-11-24',[{...form('one'),client_photo_url:'private/photo.png',client_signature_url:'private/signature.png'}]);
  const output=pdf.output();expect(output).toContain('Client photo');expect(output).toContain('Client signature');expect(output).toContain('/Subtype /Image');
 });
});