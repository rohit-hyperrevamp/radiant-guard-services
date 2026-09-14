import { createServerFn } from "@tanstack/react-start";

import { MigrationSheetInputSchema } from "./sheet-ocr-types";
import type { MigrationSheetResult } from "./sheet-ocr-types";

export type {
  MigrationSheetDay,
  MigrationSheetEmployee,
  MigrationSheetResult,
} from "./sheet-ocr-types";

export const extractMigrationSheet = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => MigrationSheetInputSchema.parse(input))
  .handler(async ({ data }): Promise<MigrationSheetResult> => {
    const { runMigrationSheetExtraction } = await import("./migration-sheet.server");
    return runMigrationSheetExtraction(data);
  });
