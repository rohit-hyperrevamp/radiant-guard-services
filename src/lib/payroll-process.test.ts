import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ error: null as {message:string}|null, payload: null as any }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
 auth: { getUser: async () => ({data:{user:{id:'actor'}}}) },
 from: (table:string) => ({select: async () => ({data:[{id:'master',code:'general_deduction',name:'General'}],error:null})}),
 rpc: async (_name:string,args:any) => { state.payload=args._payload; return {error:state.error}; },
} }));
import { processPayrollRun, processPayrollAmendment, bankFilePayments } from './payroll-process';
const row = { candidateId:'employee',employeeCode:'1',name:'Employee',deductions:[{name:'PT',amount:200}],employerContributions:[{name:'EPF',amount:300}],additions:[],netPay:1000,paidDays:26 };
const args = {runId:'run',unitId:'site',unitLabel:'Site',periodStart:'2026-09-01',periodEnd:'2026-09-30',rows:[row],heldCandidateIds:[]};
beforeEach(()=>{state.error=null;state.payload=null;});
describe('single payroll posting boundary',()=>{
 it('refuses repeated duty-line keys before any payroll save',async()=>{
  const keyed={...row,payrollLineKey:'employee|guard|8'};
  await expect(processPayrollRun({...args,rows:[keyed,keyed]})).rejects.toThrow('Duplicate payroll duty line');
  expect(state.payload).toBeNull();
 });
 it('refuses unresolved saved-contract exceptions before any payroll save',async()=>{
  await expect(processPayrollRun({...args,rows:[{...row,calculationIssues:[{blocking:true,detail:'Repeated PF'}]}]})).rejects.toThrow('Resolve saved contract exceptions');
  expect(state.payload).toBeNull();
 });
 it('sends all ledgers and saved payroll in one call',async()=>{
  await processPayrollRun(args);
  expect(state.payload.deductions[0].amount).toBe(200);
  expect(state.payload.contributions[0].amount).toBe(300);
  expect(state.payload.snapshots[0].net_pay).toBe(1000);
 });
 it('failure returns no successful payroll result',async()=>{
  state.error={message:'transaction failed'};
  await expect(processPayrollRun(args)).rejects.toThrow('transaction failed');
 });
 it('held duplicate role lines create one hold and aggregated snapshot, not deductions',async()=>{
  await processPayrollRun({...args,rows:[row,row],heldCandidateIds:['employee']});
  expect(state.payload.holds).toHaveLength(1);
  expect(state.payload.deductions).toHaveLength(0);
  expect(state.payload.snapshots).toHaveLength(1);
  expect(state.payload.snapshots[0].net_pay).toBe(2000);
 });
 it('amendments use the same transaction boundary',async()=>{
  await processPayrollAmendment({...args,version:2,deltas:[]});
  expect(state.payload.mode).toBe('amendment');
  expect(state.payload.snapshots[0].version).toBe(2);
 });
 it('amendment arrears additions are scoped to the site like deduction rows (P4)',async()=>{
  const t={paidDays:20,edDays:0,gross:10000,totalDeductions:0,totalEmployer:0,netPay:10000};
  await processPayrollAmendment({...args,version:2,deltas:[{candidateId:'employee',employeeCode:'1',name:'Employee',before:t,after:{...t,paidDays:26,gross:12900,netPay:12900}}]});
  expect(state.payload.additions).toHaveLength(1);
  expect(state.payload.additions[0].unit_id).toBe('site');
 });
});
describe('bank file payments (P1)',()=>{
 const rows=[{id:'a'},{id:'a'},{id:'b'},{id:'c'},{id:'d'}];
 const snaps=[
  {candidate_id:'a',version:2,net_pay:9999,on_hold:false},
  {candidate_id:'a',version:1,net_pay:12345.5,on_hold:false},
  {candidate_id:'b',version:1,net_pay:8000,on_hold:true},
  {candidate_id:'c',version:1,net_pay:7000,on_hold:false},
 ];
 it('pays only posted, unheld people once, at the first posted net exactly as stored',()=>{
  const r=bankFilePayments(rows,snaps,['c']);
  expect(r.payments.map((p)=>[p.row.id,p.net])).toEqual([['a',12345.5]]);
  expect(r.held).toBe(2);
  expect(r.unposted).toBe(1);
 });
});
