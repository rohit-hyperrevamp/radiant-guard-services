import { z } from "zod";

/**
 * Shared, browser-safe schemas + types for the two sheet-reading (OCR) flows:
 * the muster-roll reader used on the attendance screen and the Migration
 * Utility reader used in Control Center.
 */

export const AttendanceOcrInputSchema = z.object({
  imageDataUrl: z.string().min(20).max(20_000_000),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(40),
  employees: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        employee_code: z.string().nullable().optional(),
        designation: z.string().nullable().optional(),
        designation_id: z.string().nullable().optional(),
      }),
    )
    .min(1)
    .max(1000),
  codes: z.array(z.object({ code: z.string(), label: z.string() })).min(1).max(40),
});

export type AttendanceOcrInput = z.infer<typeof AttendanceOcrInputSchema>;

export type AttendanceOcrRow = {
  candidate_id: string;
  designation_id: string | null;
  entry_date: string;
  code: string;
  ot_hours: number;
  confident: boolean;
};

export type AttendanceOcrRowSummary = {
  candidate_id: string;
  designation_id: string | null;
  p_days: number | null;
  ot_days: number | null;
  t_days: number | null;
  confident: boolean;
};

export type AttendanceOcrResult = {
  rows: AttendanceOcrRow[];
  row_summaries: AttendanceOcrRowSummary[];
  unmatched_names: string[];
  notes: string;
};

export const MigrationSheetInputSchema = z
  .object({
    imageDataUrl: z.string().min(20).max(20_000_000).optional(),
    imageDataUrls: z.array(z.string().min(20).max(20_000_000)).min(1).max(12).optional(),
    sheetText: z.string().min(5).max(400_000).optional(),
    dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(40),
    codes: z.array(z.object({ code: z.string(), label: z.string() })).min(1).max(40),
    designations: z.array(z.object({ id: z.string(), name: z.string() })).max(50),
  })
  .refine((v) => Boolean(v.imageDataUrl || v.imageDataUrls?.length || v.sheetText), {
    message: "Provide either a sheet image or spreadsheet text",
  });

export type MigrationSheetInput = z.infer<typeof MigrationSheetInputSchema>;

export type MigrationSheetDay = { entry_date: string; code: string; ot_hours: number };

export type MigrationSheetEmployee = {
  name: string;
  employee_code: string;
  mobile: string;
  designation_id: string | null;
  designation_name: string;
  days: MigrationSheetDay[];
};

export type MigrationSheetResult = {
  employees: MigrationSheetEmployee[];
  notes: string;
};
