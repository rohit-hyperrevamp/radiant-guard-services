import { fetchPeriodContract } from "@/lib/period-contract";
import { fetchAttendedCandidateIds } from "@/lib/period-roster";
import { mergePayItems, payItemKey, standardPayItemName } from "@/lib/pay-item-names";
import { supabase } from "../pchk/shim";
import { holidayMapForDates } from "@/lib/public-holidays";
import { normShift, shiftKey } from "@/lib/shift-resources";
import { applyRateRevisionsForPeriod } from "@/lib/rate-revisions";
import { hydrateFormulasFromMaster } from "@/lib/contract-hydrate";
import {
  applyEpfBreakdownToWageComputation,
  applyEmployeeAdditions,
  applyLwfToWageComputation,
  applyPtToWageComputation,
  computeAttendanceTotals,
  computeWages,
  fmtINR,
  resolvePtAmount,
  type AttendanceCodeLike,
  type AttendanceEntryLike,
  type ContractResourceLike,
  type PincodeRangeLike,
  type PtSlabLike,
  EXTRA_DUTY_COMPONENT_RE,
} from "@/lib/payroll-calc";
import { resolveLwf, type LwfRow } from "@/lib/lwf-lookup";
import { fetchAttendanceEntriesForPeriod } from "@/lib/attendance-fetch";
import { fetchOtherSitePtTotals, ptForSite } from "@/lib/pt-cross-site";
const supabaseSessionReady = async () => {};
const searchSchema = z.object({
