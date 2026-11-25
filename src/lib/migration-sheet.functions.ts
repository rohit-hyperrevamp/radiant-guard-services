import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { MigrationSheetInputSchema } from "./sheet-ocr-types";
import type { MigrationSheetResult } from "./sheet-ocr-types";

export type {
  MigrationSheetDay,
  MigrationSheetEmployee,
  MigrationSheetResult,
} from "./sheet-ocr-types";

export const extractMigrationSheet = createServerFn({ method: "POST" })
  // Signed-in users only: each call spends the paid AI budget.
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => MigrationSheetInputSchema.parse(input))
  .handler(async ({ data }): Promise<MigrationSheetResult> => {
    const { runMigrationSheetExtraction } = await import("./migration-sheet.server");
    return runMigrationSheetExtraction(data);
  });
