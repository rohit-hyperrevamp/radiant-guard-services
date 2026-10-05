import { computeBenefitAmount, toggleLineRoundOff } from "../src/routes/admin.contracts.client-contracts";
import { computeWages, computeAttendanceTotals } from "../src/lib/payroll-calc";
const comps:any=[{allowanceId:"b",name:"Basic",amount:7722.37},{allowanceId:"h",name:"HRA",amount:3089.14}];
const pf:any={name:"EE EPF",calcType:"percentage",percentage:12,baseComponents:[{label:"Basic",operator:"+"}],capAmount:null,capFlatAmount:null,amount:0};
const r=(n:string,a:any,b:any)=>console.log(n.padEnd(48),"exact:",a,"| rounded:",b, "| pass:", b===Math.round(a));
// 1 percentage deduction
r("T1 EPF 12% of Basic", computeBenefitAmount(pf,comps), computeBenefitAmount({...pf,roundOff:true},comps));
// 2 formula employer contribution
const f:any={name:"Bonus",calcType:"percentage",percentage:0,baseComponents:[],capAmount:null,capFlatAmount:null,amount:0,formulaMode:"advanced",formulaExpression:"(basic) * 8.33 / 100"};
r("T2 Formula Bonus 8.33% Basic", computeBenefitAmount(f,comps), computeBenefitAmount({...f,roundOff:true},comps));
// 3 fixed manual toggle on/off restores exact
const fx:any={name:"Uniform",calcType:"fixed",amount:641.14};
const on=toggleLineRoundOff(fx,false), off=toggleLineRoundOff(on,false);
console.log("T3 Manual 641.14 toggle on→",on.amount,"off→",off.amount,"| pass:",on.amount===641&&off.amount===641.14);
// 4 untoggled stays exact
console.log("T4 Toggle off keeps exact:", computeBenefitAmount({...pf,roundOff:false},comps), "| pass:", computeBenefitAmount({...pf,roundOff:false},comps)===926.68);
// 5 payroll with partial attendance
const res:any=(ro:boolean)=>({designationId:"x",components:[{name:"Basic",amount:7722.37,roundOff:ro},{name:"HRA",amount:3089.14}],benefits:[],deductions:[{...pf,roundOff:ro}],employerContributions:[],payrollDayBase:{method:"fixed_days",fixedDays:26,weeklyOffDay:null}});
const totals:any={pDays:19,otHours:0,otDays:0,phDays:0,otherPaidDays:0,tDays:19};
const a=computeWages(totals,res(false),30), b=computeWages(totals,res(true),30);
console.log("T5 Payroll 19/26 days  Basic exact",a.components[0].amount,"rounded",b.components[0].amount,"| EPF exact",a.deductions[0]?.amount,"rounded",b.deductions[0]?.amount,"| HRA untouched",a.components[1].amount===b.components[1].amount);
