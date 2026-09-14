import { createServerFn } from "@tanstack/react-start";

import { AttendanceOcrInputSchema } from "./sheet-ocr-types";
import type { AttendanceOcrResult } from "./sheet-ocr-types";

export type {
  AttendanceOcrResult,
  AttendanceOcrRow,
  AttendanceOcrRowSummary,
} from "./sheet-ocr-types";

export const extractAttendanceFromImage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AttendanceOcrInputSchema.parse(input))
  .handler(async ({ data }): Promise<AttendanceOcrResult> => {
    const { runAttendanceOcr } = await import("./attendance-ocr.server");
    return runAttendanceOcr(data);
  });
