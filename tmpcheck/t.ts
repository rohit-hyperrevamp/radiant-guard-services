import { computeBenefitAmount } from "../src/routes/admin.contracts.client-contracts";
const comps=[["Basic",7722],["HRA",3089],["Other Allowance",4000],["Transportation Allowance",750],["Hardship Allowance",500],["Washing Allowance",1250],["Bonus / Exgratia",643],["Leave with Wages",386]].map(([name,amount]:any)=>({name,amount,allowanceId:null}));
const ee={name:"EE EPF Contribution (Gross-HRA-WA-Bonus-LWW)",calcType:"percentage",percentage:12,baseComponents:[],capAmount:null,capFlatAmount:null,amount:1556.64,formulaMode:"advanced",formulaExpression:"(gross - hra - washing_allowance - bonus_exgratia - leave_with_wages) * 0.12"};
console.log(computeBenefitAmount(ee as any, comps as any, [], [], []));
