/** Contract opt-out leaves the existing state-based GST split unchanged. */
export function taxSplit(taxableValue: number, intraState: boolean, gstOption?: string | null) {
  const enabled = gstOption !== "none";
  const round = (value: number) => Math.round(value * 100) / 100;
  const cgst = enabled && intraState ? round(taxableValue * 0.09) : 0;
  const sgst = enabled && intraState ? round(taxableValue * 0.09) : 0;
  const igst = enabled && !intraState ? round(taxableValue * 0.18) : 0;
  return { cgst, sgst, igst, total: round(cgst + sgst + igst) };
}

export function finalInvoiceTax(lines: { taxableValue: number; gstOption?: string | null }[], intraState: boolean) {
  return Math.round(lines.reduce((sum, line) => sum + taxSplit(line.taxableValue, intraState, line.gstOption).total, 0) * 100) / 100;
}