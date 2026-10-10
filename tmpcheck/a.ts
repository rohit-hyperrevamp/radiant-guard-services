import { canonicalComponentName } from "@/lib/payroll-calc";
for (const n of ["Bonus (Addition)","Spl. Allowance (DA)","HRA 5% (Basic+DA)","Extra Duty Charges (4Hrs.)"]) console.log(n,"=>",canonicalComponentName(n));
