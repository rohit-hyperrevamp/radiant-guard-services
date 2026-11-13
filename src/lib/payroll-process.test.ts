import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ error: null as {message:string}|null, payload: null as any }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
 auth: { getUser: async () => ({data:{user:{id:'actor'}}}) },
 from: (table:string) => ({select: async () => ({data:[{id:'master',code:'general_deduction',name:'General'}],error:null})}),
 rpc: async (_name:string,args:any) => { state.payload=args._payload; return {error:state.error}; },
} }));
import { processPayrollRun, processPayrollAmendment } from './payroll-process';
const row = { candidateId:'employee',employeeCode:'1',name:'Employee',deductions:[{name:'PT',amount:200}],employerContributions:[{name:'EPF',amount:300}],additions:[],netPay:1000,paidDays:26 };
const args = {runId:'run',unitId:'site',unitLabel:'Site',periodStart:'2026-09-01',periodEnd:'2026-09-30',rows:[row],heldCandidateIds:[]};
beforeEach(()=>{state.error=null;state.payload=null;});
describe('single payroll posting boundary',()=>{
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
});
