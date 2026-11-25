import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { AttendanceOcrInputSchema } from "./sheet-ocr-types";
import type { AttendanceOcrResult } from "./sheet-ocr-types";

export type {
  AttendanceOcrResult,
  AttendanceOcrRow,
  AttendanceOcrRowSummary,
} from "./sheet-ocr-types";

export const extractAttendanceFromImage = createServerFn({ method: "POST" })
  // Signed-in users only: each call spends the paid AI budget.
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AttendanceOcrInputSchema.parse(input))
  .handler(async ({ data }): Promise<AttendanceOcrResult> => {
    const { runAttendanceOcr } = await import("./attendance-ocr.server");
    return runAttendanceOcr(data);
  });
