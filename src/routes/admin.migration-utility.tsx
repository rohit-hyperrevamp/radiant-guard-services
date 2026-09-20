import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DatabaseZap,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  Search,
  Wand2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MonthYearPicker } from "@/components/MonthYearPicker";
import { fetchPayrollWindowsByUnit, payrollPeriodForMonth } from "@/lib/payroll-period";
import { fetchUnitDesignations } from "@/lib/unit-designations";
import { logActivity } from "@/lib/activity-log";
import { extractMigrationSheetViaApi } from "@/lib/sheet-ocr-api";
import { scanDocument } from "@/lib/document-scan";
import { DataPagination, usePagination } from "@/components/DataPagination";

export const Route = createFileRoute("/admin/migration-utility")({
  component: MigrationUtilityPage,
  head: () => ({
    meta: [
      { title: "Migration Utility | Radiant Control Center" },
      {
        name: "description",
        content:
          "Migrate a legacy attendance sheet into a contract — create employees, fill the muster roll and hand off to payroll and invoicing.",
      },
      { property: "og:title", content: "Migration Utility | Radiant Control Center" },
      {
        property: "og:description",
        content: "Create employees and back-fill attendance for a contract month, then release payroll and invoice.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const MODULE = "Migration Utility";

type ContractHit = {
  id: string;
  contract_code: string;
  unit_id: string;
  payroll_window_id: string | null;
  unit_name: string;
  unit_code: string;
  customer_name: string;
};

type SheetRow = {
  name: string;
  employee_code: string;
  mobile: string;
  designation_id: string | null;
  cells: Record<string, { code: string; ot: number }>;
};

function isoList(start: string, end: string) {
  const out: string[] = [];
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  const cur = new Date(ys!, (ms ?? 1) - 1, ds ?? 1);
  const last = new Date(ye!, (me ?? 1) - 1, de ?? 1);
  while (cur <= last) {
    out.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`,
    );
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** Parse "P", "P*1", "ED", "D,1" style tokens into a code + extra-duty days. */
function parseToken(token: string, allowed: Set<string>) {
  const raw = token.trim().toUpperCase();
  if (!raw || raw === "-" || raw === ".") return null;
  const m = raw.match(/^([A-Z]+)\s*(?:[*+,:]\s*(\d+(?:\.\d+)?))?$/);
  if (!m) return null;
  let code = m[1]!;
  const ot = m[2] ? Number(m[2]) : 0;
  if (code === "D" || code === "ED") return { code: "P", ot: ot || 1 };
  if (!allowed.has(code)) {
    if (code === "PR") code = "P";
    else if (!allowed.has(code)) return null;
  }
  return { code, ot };
}

function normalizedCell(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function excelDateKey(value: unknown, dates: string[]) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  const raw = normalizedCell(value);
  const iso = raw.match(/^(\d{4})[-/]([01]?\d)[-/]([0-3]?\d)$/);
  if (iso) return `${iso[1]}-${iso[2]!.padStart(2, "0")}-${iso[3]!.padStart(2, "0")}`;
  const day = raw.match(/^(?:[A-Za-z]{3,9}[ -])?([0-3]?\d)(?:st|nd|rd|th)?$/i);
  if (!day) return null;
  return dates.find((date) => Number(date.slice(-2)) === Number(day[1])) ?? null;
}

function parseSpreadsheetRows(
  matrix: unknown[][],
  dates: string[],
  allowedCodes: Set<string>,
  designations: Array<{ id: string; name: string }>,
) {
  const rows = matrix.filter((row) => row.some((cell) => normalizedCell(cell)));
  if (!rows.length) return [];

  const headerIndex = rows.findIndex((row) => {
    const labels = row.map((cell) => normalizedCell(cell).toLowerCase());
    return labels.some((label) => /^(employee )?name$|^guard name$|^staff name$/.test(label)) &&
      row.filter((cell) => excelDateKey(cell, dates)).length > 0;
  });
  if (headerIndex < 0) return [];

  const header = rows[headerIndex]!;
  const labels = header.map((cell) => normalizedCell(cell).toLowerCase());
  const findColumn = (patterns: RegExp[]) => labels.findIndex((label) => patterns.some((pattern) => pattern.test(label)));
  const nameCol = findColumn([/^(employee )?name$/, /^guard name$/, /^staff name$/]);
  const codeCol = findColumn([
    /^emp(loyee)?[ ._-]*(code|id|no|number)\b/i,
    /^(employee|emp)[ ._-]*(code|id)$/i,
    /^(code|id|emp id|empid|emp code|empcode|token|token no)$/i,
    /employee[ ._-]*(code|id|no)/i,
  ]);
  const mobileCol = findColumn([/mobile/, /phone/, /contact/]);
  const designationCol = findColumn([/designation/, /^post$/, /^role$/]);
  const dateColumns = header
    .map((cell, index) => ({ index, date: excelDateKey(cell, dates) }))
    .filter((item): item is { index: number; date: string } => Boolean(item.date));
  if (nameCol < 0 || !dateColumns.length) return [];

  const defaultDesignation = designations.length === 1 ? designations[0]!.id : null;
  const parsed: SheetRow[] = [];
  for (const source of rows.slice(headerIndex + 1)) {
    const name = normalizedCell(source[nameCol]);
    if (!name || /^(total|grand total|signature|authori[sz]ed)/i.test(name)) continue;
    const cells: SheetRow["cells"] = {};
    for (const column of dateColumns) {
      const token = parseToken(normalizedCell(source[column.index]), allowedCodes);
      if (token) cells[column.date] = { code: token.code, ot: token.ot };
    }
    if (!Object.keys(cells).length) continue;
    const designationName = designationCol >= 0 ? normalizedCell(source[designationCol]).toLowerCase() : "";
    const designationId = designations.find((item) => item.name.toLowerCase() === designationName)?.id ?? defaultDesignation;
    parsed.push({
      name,
      employee_code: codeCol >= 0 ? normalizedCell(source[codeCol]) : "",
      mobile: mobileCol >= 0 ? normalizedCell(source[mobileCol]).replace(/\D/g, "").slice(-10) : "",
      designation_id: designationId,
      cells,
    });
  }
  return parsed;
}

function MigrationUtilityPage() {
  const [codeInput, setCodeInput] = useState("");
  const [contract, setContract] = useState<ContractHit | null>(null);
  const now = new Date();
  const [ym, setYm] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [paste, setPaste] = useState("");
  const [parsing, setParsing] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const pg = usePagination(rows);

  const [yStr, mStr] = ym.split("-");
  const year = Number(yStr);
  const monthIdx = Number(mStr) - 1;

  const { data: codes = [] } = useQuery({
    queryKey: ["migration", "attendance-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_codes" as never)
        .select("code,label")
        .order("code");
      if (error) throw error;
      return (data ?? []) as unknown as Array<{ code: string; label: string }>;
    },
  });
  const allowedCodes = useMemo(() => new Set(codes.map((c) => c.code.toUpperCase())), [codes]);

  const { data: payrollWindow } = useQuery({
    queryKey: ["migration", "payroll-window", contract?.unit_id ?? ""],
    enabled: Boolean(contract?.unit_id),
    queryFn: async () => (await fetchPayrollWindowsByUnit([contract!.unit_id])).get(contract!.unit_id) ?? null,
  });

  const period = useMemo(
    () => payrollPeriodForMonth(year, monthIdx, payrollWindow ?? null),
    [year, monthIdx, payrollWindow],
  );
  const dates = useMemo(() => isoList(period.start, period.end), [period.start, period.end]);

  const { data: designations = [] } = useQuery({
    queryKey: ["migration", "unit-designations", contract?.unit_id ?? ""],
    enabled: Boolean(contract?.unit_id),
    queryFn: () => fetchUnitDesignations(contract!.unit_id),
  });

  const lookup = useMutation({
    mutationFn: async (): Promise<ContractHit> => {
      const q = codeInput.trim();
      if (!q) throw new Error("Enter a contract ID");
      const { data, error } = await supabase
        .from("client_contracts" as never)
        .select("id, contract_code, unit_id, payroll_window_id, units:unit_id(name, code, customers:customer_id(name))")
        .ilike("contract_code", `%${q}%`)
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error(`No contract found for "${q}"`);
      const r = data as unknown as {
        id: string;
        contract_code: string;
        unit_id: string;
        payroll_window_id: string | null;
        units?: { name?: string; code?: string; customers?: { name?: string } | null } | null;
      };
      if (!r.unit_id) throw new Error("This contract is not mapped to a client");
      return {
        id: r.id,
        contract_code: r.contract_code,
        unit_id: r.unit_id,
        payroll_window_id: r.payroll_window_id,
        unit_name: r.units?.name ?? "",
        unit_code: r.units?.code ?? "",
        customer_name: r.units?.customers?.name ?? "",
      };
    },
    onSuccess: (hit) => {
      setContract(hit);
      setRows([]);
      setLog([]);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Lookup failed"),
  });

  const applyRows = (next: SheetRow[]) => {
    setRows(next);
    toast.success(`${next.length} employee row${next.length === 1 ? "" : "s"} ready for review`);
  };

  const parsePaste = () => {
    const defaultDesig = designations[0]?.id ?? null;
    const next: SheetRow[] = [];
    for (const line of paste.split("\n")) {
      if (!line.trim()) continue;
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length < 2) continue;
      const tokens = (parts[parts.length - 1] ?? "").split(/[,\s]+/).filter(Boolean);
      const name = parts[0] ?? "";
      const employee_code = parts.length >= 3 ? parts[1] ?? "" : "";
      const mobile = parts.length >= 4 ? (parts[2] ?? "").replace(/\D/g, "").slice(-10) : "";
      const desigName = parts.length >= 5 ? (parts[3] ?? "").toLowerCase() : "";
      const designation_id =
        designations.find((d) => d.name.toLowerCase() === desigName)?.id ?? defaultDesig;
      const cells: Record<string, { code: string; ot: number }> = {};
      tokens.forEach((tok, idx) => {
        const date = dates[idx];
        if (!date) return;
        const parsed = parseToken(tok, allowedCodes);
        if (parsed) cells[date] = { code: parsed.code, ot: parsed.ot };
      });
      next.push({ name, employee_code, mobile, designation_id, cells });
    }
    if (!next.length) {
      toast.error("Nothing could be parsed — check the row format");
      return;
    }
    applyRows(next);
  };

  const fileToDataUrl = (file: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read the file"));
      reader.readAsDataURL(file);
    });

  const pdfToImageDataUrls = async (file: File) => {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const workerUrl = (await import("pdfjs-dist/legacy/build/pdf.worker.mjs?url")).default;
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const urls: string[] = [];
    const pageCount = Math.min(doc.numPages, 12);
    for (let p = 1; p <= pageCount; p += 1) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) continue;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: context, viewport, canvas }).promise;
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (blob) urls.push(await fileToDataUrl(blob));
    }
    await doc.destroy();
    if (!urls.length) throw new Error("That PDF could not be rendered");
    return urls;
  };

  const onUpload = async (fileList: File[]) => {
    const files = fileList.filter(Boolean);
    if (!files.length || !contract) return;
    setParsing(true);
    try {
      const spreadsheets = files.filter((f) => /\.(xlsx|xlsm|xlsb|xls|csv)$/i.test(f.name));
      const pdfs = files.filter((f) => /\.pdf$/i.test(f.name));
      const imageFiles = files.filter(
        (f) => !spreadsheets.includes(f) && !pdfs.includes(f) && /^image\//i.test(f.type),
      );
      const unsupported = files.filter(
        (f) => !spreadsheets.includes(f) && !pdfs.includes(f) && !imageFiles.includes(f),
      );
      if (unsupported.length && !spreadsheets.length && !pdfs.length && !imageFiles.length) {
        throw new Error(`Unsupported file type: ${unsupported[0]!.name}`);
      }
      let payload: { imageDataUrls?: string[]; sheetText?: string } | null = null;

      if (spreadsheets.length) {
        const XLSX = await import("xlsx");
        const parts: string[] = [];
        const directRows: SheetRow[] = [];
        for (const file of spreadsheets) {
          const buf = await file.arrayBuffer();
          const wb = XLSX.read(buf, { type: "array", cellDates: true });
          for (const name of wb.SheetNames) {
            const ws = wb.Sheets[name];
            if (!ws) continue;
            const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true });
            directRows.push(...parseSpreadsheetRows(matrix, dates, allowedCodes, designations));
            const tsv = XLSX.utils.sheet_to_csv(ws, { FS: "\t", blankrows: false });
            if (tsv.trim()) parts.push(`--- ${file.name} / Sheet: ${name} ---\n${tsv}`);
          }
        }
        if (directRows.length) {
          applyRows(directRows);
          return;
        }
        const sheetText = parts.join("\n\n").slice(0, 380_000);
        if (sheetText.trim()) payload = { sheetText };
        else if (!pdfs.length && !imageFiles.length) throw new Error("That spreadsheet appears to be empty");
      }

      if (!payload) {
        const imageDataUrls: string[] = [];
        for (const file of pdfs) imageDataUrls.push(...(await pdfToImageDataUrls(file)));
        // Photos go through the document scanner first: cropped to the sheet,
        // straightened and sharpened, which lifts read accuracy on desk shots.
        for (const file of imageFiles) {
          try {
            const scan = await scanDocument(file);
            if (scan.quality.verdict === "poor") toast.warning(`${file.name}: ${scan.quality.hint}`);
            imageDataUrls.push(scan.dataUrl);
          } catch {
            imageDataUrls.push(await fileToDataUrl(file));
          }
        }
        if (!imageDataUrls.length) throw new Error("Unsupported file type");
        payload = { imageDataUrls: imageDataUrls.slice(0, 12) };
      }


      const result = await extractMigrationSheetViaApi({
        ...payload,
        dates,
        codes: codes.map((c) => ({ code: c.code, label: c.label })),
        designations: designations.map((d) => ({ id: d.id, name: d.name })),
      });
      const next: SheetRow[] = result.employees.map((e) => {
        const cells: Record<string, { code: string; ot: number }> = {};
        for (const d of e.days) cells[d.entry_date] = { code: d.code, ot: d.ot_hours };
        return {
          name: e.name,
          employee_code: e.employee_code,
          mobile: e.mobile,
          designation_id: e.designation_id ?? designations[0]?.id ?? null,
          cells,
        };
      });
      if (!next.length) throw new Error("No employee rows were detected on that sheet");
      applyRows(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read the sheet");
    } finally {
      setParsing(false);
    }
  };

  const run = useMutation({
    mutationFn: async () => {
      if (!contract) throw new Error("Pick a contract first");
      if (!rows.length) throw new Error("Load an attendance sheet first");
      const messages: string[] = [];
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id ?? null;

      // Step 1 — employees.
      const candidateIds: string[] = [];
      for (const row of rows) {
        let candidateId: string | null = null;
        if (row.employee_code) {
          const { data } = await supabase
            .from("candidates" as never)
            .select("id")
            .eq("employee_code", row.employee_code)
            .limit(1)
            .maybeSingle();
          candidateId = (data as { id?: string } | null)?.id ?? null;
        }
        if (!candidateId && row.mobile) {
          const { data } = await supabase
            .from("candidates" as never)
            .select("id")
            .eq("mobile", row.mobile)
            .limit(1)
            .maybeSingle();
          candidateId = (data as { id?: string } | null)?.id ?? null;
        }
        if (!candidateId) {
          const { data } = await supabase
            .from("candidates" as never)
            .select("id")
            .ilike("full_name", row.name)
            .eq("unit_id", contract.unit_id)
            .limit(1)
            .maybeSingle();
          candidateId = (data as { id?: string } | null)?.id ?? null;
        }

        if (candidateId) {
          messages.push(`Existing employee reused — ${row.name}`);
        } else {
          let roleKey: string | null = null;
          if (row.designation_id) {
            const { data: cr } = await supabase
              .from("contract_resources" as never)
              .select("role_key")
              .eq("contract_id", contract.id)
              .eq("designation_id", row.designation_id)
              .not("role_key", "is", null)
              .limit(1)
              .maybeSingle();
            roleKey = (cr as { role_key?: string | null } | null)?.role_key ?? null;
          }
          const { data: created, error: insErr } = await supabase
            .from("candidates" as never)
            .insert({
              full_name: row.name,
              employee_code: row.employee_code,
              mobile: row.mobile,
              status: "active",
              unit_id: contract.unit_id,
              designation_id: row.designation_id,
              role_key: roleKey || "guard",
              application_date: period.start,
              created_by: uid,
            } as never)
            .select("id")
            .single();
          if (insErr) throw new Error(`Could not create ${row.name}: ${insErr.message}`);
          candidateId = (created as { id: string }).id;
          messages.push(`Employee created — ${row.name}`);
        }

        // Step 2 — unit mapping (primary posting on this contract's unit).
        const { data: mapping } = await supabase
          .from("candidate_units" as never)
          .select("id")
          .eq("candidate_id", candidateId)
          .eq("unit_id", contract.unit_id)
          .limit(1)
          .maybeSingle();
        if (!mapping) {
          const { error: mapErr } = await supabase.from("candidate_units" as never).insert({
            candidate_id: candidateId,
            unit_id: contract.unit_id,
            designation_id: row.designation_id,
            is_primary: true,
            is_reliever: false,
            sort_order: 0,
          } as never);
          if (mapErr) throw new Error(`Client mapping failed for ${row.name}: ${mapErr.message}`);
        }
        candidateIds.push(candidateId);
      }

      // Step 3 — attendance, apple to apple with the sheet.
      const entries = rows.flatMap((row, idx) =>
        Object.entries(row.cells).map(([entry_date, cell]) => ({
          unit_id: contract.unit_id,
          candidate_id: candidateIds[idx]!,
          designation_id: row.designation_id,
          entry_date,
          code: cell.code,
          ot_hours: cell.ot,
        })),
      );
      for (let i = 0; i < entries.length; i += 500) {
        const { error } = await supabase
          .from("attendance_entries" as never)
          .upsert(entries.slice(i, i + 500) as never, {
            onConflict: "unit_id,candidate_id,designation_id,entry_date",
          });
        if (error) throw new Error(`Attendance write failed: ${error.message}`);
      }
      messages.push(`${entries.length} attendance day-cells written for ${period.start} → ${period.end}`);

      // Step 4 — approve the muster roll for the period.
      const ts = new Date().toISOString();
      const sheetBase = {
        unit_id: contract.unit_id,
        period_start: period.start,
        period_end: period.end,
        status: "approved",
        submitted_at: ts,
        submitted_by: uid,
        approved_at: ts,
        approved_by: uid,
        rejection_reason: "",
      };
      const { data: existingSheet } = await supabase
        .from("attendance_sheets" as never)
        .select("id")
        .eq("unit_id", contract.unit_id)
        .eq("period_start", period.start)
        .eq("period_end", period.end)
        .maybeSingle();
      const sheetWrite = existingSheet
        ? await supabase
            .from("attendance_sheets" as never)
            .update(sheetBase as never)
            .eq("id", (existingSheet as { id: string }).id)
        : await supabase.from("attendance_sheets" as never).insert(sheetBase as never);
      if (sheetWrite.error) throw new Error(`Attendance approval failed: ${sheetWrite.error.message}`);
      messages.push("Muster roll approved");

      // Step 5 — release to payroll & invoice.
      const runBase = {
        unit_id: contract.unit_id,
        period_start: period.start,
        period_end: period.end,
        status: "submitted",
        submitted_at: ts,
        submitted_by: uid,
        rejection_reason: null,
      };
      const { data: existingRun } = await supabase
        .from("payroll_runs" as never)
        .select("id")
        .eq("unit_id", contract.unit_id)
        .eq("period_start", period.start)
        .eq("period_end", period.end)
        .maybeSingle();
      const runWrite = existingRun
        ? await supabase
            .from("payroll_runs" as never)
            .update(runBase as never)
            .eq("id", (existingRun as { id: string }).id)
        : await supabase.from("payroll_runs" as never).insert(runBase as never);
      if (runWrite.error) throw new Error(`Payroll handoff failed: ${runWrite.error.message}`);
      messages.push("Payroll and invoice released for this period");

      await logActivity({
        module: MODULE,
        action: "create",
        entityType: "attendance_sheets",
        entityLabel: `${contract.contract_code} ${period.start} → ${period.end}`,
        details: {
          contract_code: contract.contract_code,
          unit_id: contract.unit_id,
          employees: rows.length,
          entries: entries.length,
        },
      });
      return messages;
    },
    onSuccess: (messages) => {
      setLog(messages);
      toast.success("Migration completed");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Migration failed"),
  });

  const totalsFor = (row: SheetRow) => {
    let p = 0;
    let ed = 0;
    for (const cell of Object.values(row.cells)) {
      if (cell.code === "P" || cell.code === "HD") p += cell.code === "HD" ? 0.5 : 1;
      ed += cell.ot;
    }
    return { p, ed };
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Migration Utility"
        description="Import attendance from images, PDF, Excel or CSV."
        crumbs={[{ label: "Control Center", to: "/admin/control-center" }, { label: "Migration Utility" }]}
      />

      {/* Step 1 — contract + month */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div>
            <Label htmlFor="contract-code">Contract ID</Label>
            <Input
              id="contract-code"
              value={codeInput}
              placeholder="e.g. CON14079"
              onChange={(e) => setCodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") lookup.mutate();
              }}
            />
          </div>
          <Button onClick={() => lookup.mutate()} disabled={lookup.isPending}>
            {lookup.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Find contract
          </Button>
          <MonthYearPicker value={ym} onChange={setYm} />
        </div>

        {contract && (
          <div className="mt-4 grid gap-2 rounded-xl border border-border bg-muted/30 p-4 text-sm sm:grid-cols-3">
            <div>
              <div className="text-xs text-muted-foreground">Contract</div>
              <div className="font-semibold">{contract.contract_code}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Client</div>
              <div className="font-semibold">
                {contract.customer_name ? `${contract.customer_name} — ` : ""}
                {contract.unit_name} {contract.unit_code ? `(${contract.unit_code})` : ""}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Attendance period</div>
              <div className="font-semibold">
                {period.start} → {period.end} ({dates.length} days)
              </div>
            </div>
            <div className="sm:col-span-3 text-xs text-muted-foreground">
              Contracted designations: {designations.map((d) => `${d.name} × ${d.quantity}`).join(", ") || "—"}
            </div>
          </div>
        )}
      </div>

      {/* Step 2 — sheet input */}
      {contract && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-display text-base font-bold">Attendance sheet</div>
              <p className="text-sm text-muted-foreground">
                Choose photos (pick several pages at once), a PDF, or an Excel/CSV file — the sheet is read
                automatically. You can also paste rows below.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[
                {
                  key: "images",
                  label: "Upload photos",
                  icon: ImageIcon,
                  accept: "image/*",
                  multiple: true,
                },
                { key: "pdf", label: "Upload PDF", icon: FileText, accept: ".pdf,application/pdf", multiple: true },
                {
                  key: "excel",
                  label: "Upload Excel / CSV",
                  icon: FileSpreadsheet,
                  accept:
                    ".xlsx,.xlsm,.xlsb,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv",
                  multiple: true,
                },
              ].map((opt) => (
                <label
                  key={opt.key}
                  className={`inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-accent/10 ${
                    parsing ? "pointer-events-none opacity-60" : "cursor-pointer"
                  }`}
                >
                  {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <opt.icon className="h-4 w-4" />}
                  {parsing ? "Reading sheet…" : opt.label}
                  <input
                    type="file"
                    multiple={opt.multiple}
                    accept={opt.accept}
                    className="hidden"
                    disabled={parsing}
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      e.target.value = "";
                      void onUpload(files);
                    }}
                  />
                </label>
              ))}
            </div>
          </div>


          <div>
            <Label htmlFor="paste">Paste rows</Label>
            <Textarea
              id="paste"
              rows={5}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={`Name | EmpCode | Mobile | Designation | P,P,A,P*1,WO,...\nor simply:  Name | P,P,A,WO,...`}
              className="font-mono text-xs"
            />
            <div className="mt-2 flex items-center gap-3">
              <Button variant="secondary" onClick={parsePaste}>
                <Wand2 className="mr-2 h-4 w-4" />
                Parse rows
              </Button>
              <span className="text-xs text-muted-foreground">
                Day codes map to {period.start} onwards. Use <code>P*1</code> or <code>ED</code> for Extra Duty days.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Step 3 — review */}
      {contract && rows.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="font-display text-base font-bold">Review — {rows.length} employees</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="p-2">Name</th>
                  <th className="p-2">Emp. code</th>
                  <th className="p-2">Mobile</th>
                  <th className="p-2">Designation</th>
                  <th className="p-2 text-right">P days</th>
                  <th className="p-2 text-right">Extra Duty</th>
                </tr>
              </thead>
              <tbody>
                {pg.pageRows.map((row) => {
                  const idx = rows.indexOf(row);
                  const t = totalsFor(row);
                  const update = (patch: Partial<SheetRow>) =>
                    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
                  return (
                    <tr key={idx} className="border-t border-border">
                      <td className="p-2">
                        <Input value={row.name} onChange={(e) => update({ name: e.target.value })} />
                      </td>
                      <td className="p-2">
                        <Input
                          value={row.employee_code}
                          onChange={(e) => update({ employee_code: e.target.value })}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={row.mobile}
                          onChange={(e) => update({ mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                        />
                      </td>
                      <td className="p-2">
                        <select
                          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                          value={row.designation_id ?? ""}
                          onChange={(e) => update({ designation_id: e.target.value || null })}
                        >
                          <option value="">—</option>
                          {designations.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 text-right font-semibold">{t.p}</td>
                      <td className="p-2 text-right font-semibold">{t.ed}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <DataPagination {...pg} />

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => run.mutate()} disabled={run.isPending}>
              {run.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <DatabaseZap className="mr-2 h-4 w-4" />
              )}
              Run migration
            </Button>
            <span className="text-xs text-muted-foreground">
              Creates missing employees, maps them to the unit, writes attendance, approves the muster roll and releases
              payroll &amp; invoice.
            </span>
          </div>
        </div>
      )}

      {log.length > 0 && contract && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="font-display text-base font-bold">Migration log</div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {log.map((line, i) => (
              <li key={i}>• {line}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3 pt-2 text-sm font-semibold">
            <Link className="text-accent" to="/admin/attendance/$unitId" params={{ unitId: contract.unit_id }}>
              Open attendance
            </Link>
            <Link
              className="text-accent"
              to="/admin/payroll/$unitId"
              params={{ unitId: contract.unit_id }}
              search={{ start: period.start, end: period.end }}
            >
              Open payroll
            </Link>
            <Link
              className="text-accent"
              to="/admin/invoice/$unitId"
              params={{ unitId: contract.unit_id }}
              search={{ start: period.start, end: period.end }}
            >
              Open invoice
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
