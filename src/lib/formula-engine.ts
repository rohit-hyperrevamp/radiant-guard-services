// Hybrid formula engine for allowance/cost component customization.
//
// Two storage shapes are supported on `allowance_types` and `cost_components`:
//   - formula_mode = "preset"   → formula_expression is JSON describing visual rows
//   - formula_mode = "advanced" → formula_expression is a free-form math expression
//
// Both modes compile down to the same expression AST and evaluator below so the
// MIS detail trace can show the resolved expression + numeric substitution.

export type FormulaContext = {
  basic?: number;
  da?: number;
  gross?: number;
  fixed_amount?: number;
  fixed_days?: number;
  working_days?: number;
  payable_days?: number;
  days_in_month?: number;
  present?: number;
  worked?: number;
  ot?: number;
  ph?: number;
  wo?: number;
  el?: number;
  pl?: number;
  [k: string]: number | undefined;
};

export const FORMULA_VARIABLES: { key: keyof FormulaContext; label: string; desc: string }[] = [
  { key: "basic",        label: "basic",        desc: "Basic component" },
  { key: "da",           label: "da",           desc: "Dearness allowance" },
  { key: "gross",        label: "gross",        desc: "Earned gross of regular wage lines (pro-rated, no ED/PH)" },
  { key: "earned_gross", label: "earned_gross", desc: "Earned gross incl. Extra Duty and Paid Holiday (for deductions)" },
  { key: "fixed_gross",  label: "fixed_gross",  desc: "Fixed full-month contract gross" },
  { key: "ed_amount",    label: "ed_amount",    desc: "Extra Duty amount earned" },
  { key: "ph_amount",    label: "ph_amount",    desc: "Paid Holiday amount earned" },
  { key: "fixed_amount", label: "fixed_amount", desc: "Manual fixed amount input on the contract" },
  { key: "fixed_days",   label: "fixed_days",   desc: "Fixed days (client base)" },
  { key: "working_days", label: "working_days", desc: "Working days in the period" },
  { key: "payable_days", label: "payable_days", desc: "Payable days for this employee" },
  { key: "days_in_month",label: "days_in_month",desc: "Calendar days in the payroll month (28/29/30/31)" },
  { key: "present",      label: "present",      desc: "Present duties" },
  { key: "worked",       label: "worked",       desc: "Alias of present duties (legacy)" },
  { key: "ot",           label: "ot",           desc: "Extra duty days (ED hrs / 8)" },
  { key: "ph",           label: "ph",           desc: "Public holiday duties" },
  { key: "wo",           label: "wo",           desc: "Weekly off duties" },
  { key: "el",           label: "el",           desc: "Earned leave" },
  { key: "pl",           label: "pl",           desc: "Paid leave" },
];

// ---------------- Preset shape ----------------

export type CompositeComponent = { name: string; operator: "+" | "-" };

export type PresetBase =
  | { kind: "basic" }
  | { kind: "da" }
  | { kind: "basic_plus_da" }
  | { kind: "gross" }
  | { kind: "fixed_amount"; value: number }
  | { kind: "variable"; name: keyof FormulaContext }
  | { kind: "composite"; components: CompositeComponent[] };

export function slugifyVar(label: string): string {
  return String(label || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "x";
}

export type PresetDivisor =
  | "none"
  | "fixed_days"
  | "working_days"
  | "payable_days"
  | { kind: "fixed_days_month"; days: 26 | 28 | 30 | 31 };

export type PresetMultiplier =
  "present" | "worked" | "ot" | "ph" | "wo" | "el" | "pl";

export type PresetFormula = {
  base: PresetBase;
  operator: "flat" | "percent" | "per_day" | "divide";
  percent?: number;                  // when operator = percent
  divisor?: PresetDivisor;           // when operator = per_day or divide
  multipliers?: PresetMultiplier[];  // sum of these is the multiplier
  capAmount?: number | null;
  floorAmount?: number | null;
};

export type FormulaConfig =
  | { mode: "preset"; preset: PresetFormula }
  | { mode: "advanced"; expression: string };

// ---------------- Tokenizer / parser ----------------

type Tok =
  | { t: "num"; v: number }
  | { t: "id"; v: string }
  | { t: "op"; v: string }
  | { t: "lp" } | { t: "rp" } | { t: "comma" };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c <= " ") { i++; continue; }
    if (c >= "0" && c <= "9" || (c === "." && src[i+1] >= "0" && src[i+1] <= "9")) {
      let j = i;
      while (j < src.length && (/[\d.]/.test(src[j]))) j++;
      out.push({ t: "num", v: Number(src.slice(i, j)) });
      i = j; continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++;
      out.push({ t: "id", v: src.slice(i, j).toLowerCase() });
      i = j; continue;
    }
    if (c === "(") { out.push({ t: "lp" }); i++; continue; }
    if (c === ")") { out.push({ t: "rp" }); i++; continue; }
    if (c === ",") { out.push({ t: "comma" }); i++; continue; }
    if ("+-*/".includes(c)) { out.push({ t: "op", v: c }); i++; continue; }
    throw new Error(`Unexpected character '${c}' at ${i}`);
  }
  return out;
}

class Parser {
  constructor(private toks: Tok[], private pos = 0) {}
  peek() { return this.toks[this.pos]; }
  eat() { return this.toks[this.pos++]; }
  parse(): Node {
    const e = this.expr();
    if (this.pos !== this.toks.length) throw new Error("Unexpected trailing tokens");
    return e;
  }
  expr(): Node { // + -
    let left = this.term();
    while (this.peek()?.t === "op" && (this.peek() as any).v.match(/[+-]/)) {
      const op = (this.eat() as any).v;
      const right = this.term();
      left = { type: "bin", op, left, right };
    }
    return left;
  }
  term(): Node { // * /
    let left = this.unary();
    while (this.peek()?.t === "op" && (this.peek() as any).v.match(/[*/]/)) {
      const op = (this.eat() as any).v;
      const right = this.unary();
      left = { type: "bin", op, left, right };
    }
    return left;
  }
  unary(): Node {
    if (this.peek()?.t === "op" && ((this.peek() as any).v === "-" || (this.peek() as any).v === "+")) {
      const op = (this.eat() as any).v;
      return { type: "unary", op, arg: this.unary() };
    }
    return this.primary();
  }
  primary(): Node {
    const t = this.eat();
    if (!t) throw new Error("Unexpected end");
    if (t.t === "num") return { type: "num", v: t.v };
    if (t.t === "lp") { const e = this.expr(); if (this.eat()?.t !== "rp") throw new Error("Expected )"); return e; }
    if (t.t === "id") {
      if (this.peek()?.t === "lp") {
        this.eat();
        const args: Node[] = [];
        if (this.peek()?.t !== "rp") {
          args.push(this.expr());
          while (this.peek()?.t === "comma") { this.eat(); args.push(this.expr()); }
        }
        if (this.eat()?.t !== "rp") throw new Error("Expected )");
        return { type: "call", name: t.v, args };
      }
      return { type: "id", name: t.v };
    }
    throw new Error("Unexpected token");
  }
}

type Node =
  | { type: "num"; v: number }
  | { type: "id"; name: string }
  | { type: "unary"; op: string; arg: Node }
  | { type: "bin"; op: string; left: Node; right: Node }
  | { type: "call"; name: string; args: Node[] };

/**
 * Loose variable key: slug tokens without numbers and qualifier words.
 * "hra_40_basic_da" (master) and "hra_40_basic_da_exact" (contract row) both
 * become "hra_basic_da"; "bonus_exgratia_8_33_basic_da_rounded" and
 * "bonus_exgratia_8_33_basic_da_exact" both become "bonus_exgratia_basic_da".
 */
const LOOSE_DROP_TOKENS = new Set(["exact", "rounded", "round", "roundoff"]);
export function looseVarKey(name: string): string {
  return String(name ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !/^\d+$/.test(t) && !LOOSE_DROP_TOKENS.has(t))
    .join("_");
}

/**
 * Resolve a formula variable that has no exact key in the context by matching
 * its loose key against the context keys. Used when a master formula names a
 * line slightly differently from the contract row (percent, "Exact",
 * "Rounded"). Returns undefined when nothing — or more than one distinct
 * value — matches, so ambiguous names never guess.
 */
function resolveLooseVar(name: string, ctx: FormulaContext): number | undefined {
  const want = looseVarKey(name);
  if (!want) return undefined;
  let found: number | undefined;
  for (const [key, value] of Object.entries(ctx)) {
    if (looseVarKey(key) !== want) continue;
    const num = Number(value) || 0;
    if (found === undefined) found = num;
    else if (Math.abs(found - num) > 0.001) return undefined;
  }
  return found;
}

function evalNode(n: Node, ctx: FormulaContext): number {
  switch (n.type) {
    case "num": return n.v;
    case "id": {
      let v = ctx[n.name];
      if (v === undefined) v = ctx[n.name.toLowerCase()];
      if (v === undefined) {
        const loose = resolveLooseVar(n.name, ctx);
        if (loose === undefined) return 0;
        ctx[n.name] = loose;
        return loose;
      }
      return Number(v) || 0;
    }
    case "unary": {
      const a = evalNode(n.arg, ctx);
      return n.op === "-" ? -a : a;
    }
    case "bin": {
      const a = evalNode(n.left, ctx);
      const b = evalNode(n.right, ctx);
      switch (n.op) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/": return b === 0 ? 0 : a / b;
      }
      return 0;
    }
    case "call": {
      const args = n.args.map((a) => evalNode(a, ctx));
      if (n.name === "min") return Math.min(...args);
      if (n.name === "max") return Math.max(...args);
      if (n.name === "round") return Math.round(args[0] ?? 0);
      if (n.name === "floor") return Math.floor(args[0] ?? 0);
      if (n.name === "ceil") return Math.ceil(args[0] ?? 0);
      return 0;
    }
  }
}

/**
 * Derived aliases every caller gets for free.
 * `earned_gross` is the label the formula builder emits for the gross chip;
 * callers already put the (pro-rated) gross under `gross`, so mirror it so a
 * formula referencing earned_gross never silently resolves to 0.
 */
export function applyDerivedAliases(ctx: FormulaContext): FormulaContext {
  const grossVal = Number(ctx.gross) || 0;
  for (const key of ["earned_gross", "earnedgross", "earned_wages", "earnedwages"]) {
    if (ctx[key] === undefined) ctx[key] = grossVal;
  }
  const ctcVal = Number(ctx.ctc) || 0;
  if (ctcVal && ctx["total_ctc"] === undefined) ctx["total_ctc"] = ctcVal;
  return ctx;
}

export function evaluateExpression(expr: string, ctx: FormulaContext): number {
  if (!expr || !expr.trim()) return 0;
  const ast = new Parser(tokenize(expr)).parse();
  return evalNode(ast, applyDerivedAliases({ ...ctx }));
}


export function validateExpression(expr: string): { ok: true } | { ok: false; error: string } {
  try { new Parser(tokenize(expr)).parse(); return { ok: true }; }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Invalid expression" }; }
}

// ---------------- Preset → expression ----------------

function baseToExpr(b: PresetBase): string {
  switch (b.kind) {
    case "basic": return "basic";
    case "da": return "da";
    case "basic_plus_da": return "(basic + da)";
    case "gross": return "gross";
    case "fixed_amount": return String(Number(b.value) || 0);
    case "variable": return String(b.name);
    case "composite": {
      const parts = (b.components ?? [])
        .filter((c) => c && c.name)
        .map((c, i) => {
          const v = slugifyVar(c.name);
          if (i === 0) return c.operator === "-" ? `-${v}` : v;
          return `${c.operator === "-" ? "-" : "+"} ${v}`;
        });
      return parts.length ? `(${parts.join(" ")})` : "0";
    }
  }
}

function divisorToExpr(d?: PresetDivisor): string | null {
  if (!d || d === "none") return null;
  if (typeof d === "string") return d; // fixed_days | working_days | payable_days
  if (d.kind === "fixed_days_month") return String(d.days);
  return null;
}

export function presetToExpression(p: PresetFormula): string {
  const base = baseToExpr(p.base);
  const mult = (p.multipliers && p.multipliers.length > 0)
    ? `(${p.multipliers.join(" + ")})`
    : null;
  const div = divisorToExpr(p.divisor);

  let core: string;
  switch (p.operator) {
    case "flat":
      core = base;
      break;
    case "percent":
      core = `${base} * ${Number(p.percent) || 0} / 100`;
      break;
    case "per_day":
      // amount = base / divisor * multiplier
      core = div ? `${base} / ${div}` : base;
      if (mult) core = `(${core}) * ${mult}`;
      break;
    case "divide":
      core = div ? `${base} / ${div}` : base;
      if (mult) core = `(${core}) * ${mult}`;
      break;
  }

  const hasCap = p.capAmount != null && Number(p.capAmount) > 0;
  const hasFloor = p.floorAmount != null && Number(p.floorAmount) > 0;
  if (hasCap && hasFloor) core = `max(${Number(p.floorAmount)}, min(${Number(p.capAmount)}, ${core}))`;
  else if (hasCap) core = `min(${Number(p.capAmount)}, ${core})`;
  else if (hasFloor) core = `max(${Number(p.floorAmount)}, ${core})`;
  return core;
}

export function evaluateFormula(config: FormulaConfig | null | undefined, ctx: FormulaContext): { amount: number; expression: string; error?: string } {
  if (!config) return { amount: 0, expression: "" };
  try {
    const expression = config.mode === "preset" ? presetToExpression(config.preset) : config.expression;
    const amount = evaluateExpression(expression, ctx);
    return { amount: Math.round(amount * 100) / 100, expression };
  } catch (e) {
    return { amount: 0, expression: "", error: e instanceof Error ? e.message : "Eval failed" };
  }
}

export const DEFAULT_PRESET: PresetFormula = {
  base: { kind: "basic" },
  operator: "flat",
  multipliers: [],
};

export function parseFormulaConfig(mode: string | null | undefined, raw: string | null | undefined): FormulaConfig | null {
  if (!mode) return null;
  if (mode === "advanced") return { mode: "advanced", expression: String(raw ?? "") };
  if (mode === "preset") {
    if (!raw) return { mode: "preset", preset: DEFAULT_PRESET };
    try { return { mode: "preset", preset: JSON.parse(raw) as PresetFormula }; }
    catch { return { mode: "preset", preset: DEFAULT_PRESET }; }
  }
  return null;
}

export function serializeFormulaConfig(cfg: FormulaConfig): { mode: string; expression: string } {
  if (cfg.mode === "advanced") return { mode: "advanced", expression: cfg.expression };
  return { mode: "preset", expression: JSON.stringify(cfg.preset) };
}
