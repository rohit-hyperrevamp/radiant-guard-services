import { supabase } from "./shim";
const ids=["aa92957d-e5b2-464d-9746-13e9b8238126","50010219-5626-41f2-913a-a13840755823","51d3a393-1b50-4831-8fa3-53d9fa6ef7fc"];
const unitId="0413d038-e508-4aac-8f9e-c129e705affd", start="2026-08-21", end="2026-09-20";
const r=await supabase.from("additions").select("candidate_id, amount, formula_expression").in("candidate_id",ids).lte("addition_date",end)
 .or(`addition_date.gte.${start},and(repeat_monthly.eq.true,or(end_date.is.null,end_date.gte.${start}))`).or(`unit_id.is.null,unit_id.eq.${unitId}`).eq("status","active");
console.log(JSON.stringify(r.data), r.error);
process.exit(0);
