import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Detail = { label: string; value: string };
type RowDetails = { host: HTMLElement; title: string; fields: Detail[] };

/** Adds progressive disclosure to existing directory tables without changing
 * their data, sort order, permissions, exports or mutation controls. */
export function SmartListLayout() {
  const anchor = useRef<HTMLSpanElement>(null);
  const [rows, setRows] = useState<RowDetails[]>([]);
  const [selected, setSelected] = useState<RowDetails | null>(null);

  useEffect(() => {
    const root = anchor.current?.closest("[data-admin-scroll]");
    if (!root) return;
    let frame = 0;
    const hosts = new Set<HTMLElement>();
    const observed = new Set<HTMLElement>();
    const resize = new ResizeObserver(() => schedule());
    const excluded = /\/(?:attendance|payroll|invoice)\/|bulk-rate-revision/;

    function refresh() {
      frame = 0;
      if (!root) return;
      const next: RowDetails[] = [];
      const tables = root.querySelectorAll<HTMLTableElement>("table");
      tables.forEach((table) => {
        // Registers, calendars and editable calculation matrices are tools,
        // not directory lists. Never collapse their cells.
        if (excluded.test(window.location.pathname) || table.closest('[role="dialog"], form') || table.hasAttribute("data-payroll-register")) return;
        const header = table.tHead?.rows[0];
        const body = table.tBodies[0];
        if (!header || !body || header.cells.length < 4 || table.querySelector('input:not([type="checkbox"]), textarea, select')) return;
        const shell = table.parentElement;
        if (!shell) return;
        if (!observed.has(shell)) { observed.add(shell); resize.observe(shell); }
        const headings = Array.from(header.cells).map((cell) => cell.textContent?.trim() || "Details");
        if (Array.from(header.cells).some((cell) => cell.colSpan > 1)) return;
        // Only record lists with row actions participate. Analytics matrices
        // and plain report tables must keep their original presentation.
        if (!headings.some((label) => /actions?/i.test(label)) && !body.querySelector('[data-col="actions"], [data-col="employee-actions"]')) return;
        const width = shell.clientWidth;
        if (!width) return;
        table.setAttribute("data-smart-list", "true");
        shell.setAttribute("data-smart-list-shell", "true");
        const visible = new Set<number>([0, 1]);
        const bodyRows = Array.from(body.rows).filter((row) => row.cells.length === headings.length && row.cells[0]?.colSpan === 1);
        const actionWidth = Math.max(110, ...bodyRows.map((row) => {
          const cell = Array.from(row.cells).find((cell, index) => /actions?/i.test(headings[index]) || /actions/.test(cell.dataset.col ?? ""));
          return cell ? cell.querySelectorAll("button, a").length * 36 + 20 : 0;
        }));
        table.style.setProperty("--smart-action-width", `${actionWidth}px`);
        // Status, key totals and every actionable cell stay in the main row.
        headings.forEach((label, index) => {
          if (/status|active|actions?|amount|total|net pay/i.test(label) || bodyRows.some((row) => row.cells[index]?.querySelector('button, a, input, [role="switch"], [role="checkbox"]'))) visible.add(index);
        });
        const budget = Math.max(3, Math.min(7, Math.floor((width - actionWidth) / 150) + 1));
        headings.forEach((_, index) => { if (visible.size < budget) visible.add(index); });
        const hidden = headings.map((_, index) => index).filter((index) => !visible.has(index));
        table.setAttribute("data-smart-stacked", String(width < (visible.size - 1) * 115 + actionWidth));
        Array.from(header.cells).forEach((cell, index) => cell.setAttribute("data-smart-secondary", String(hidden.includes(index))));
        bodyRows.forEach((row) => {
          Array.from(row.cells).forEach((cell, index) => {
            cell.setAttribute("data-smart-secondary", String(hidden.includes(index)));
            if (!cell.dataset.label) cell.dataset.label = headings[index];
            if (/actions?/i.test(headings[index]) && !cell.dataset.col) cell.dataset.col = "actions";
          });
          const primary = row.cells[1] ?? row.cells[0];
          if (!primary) return;
          let host = primary.querySelector<HTMLElement>(":scope > [data-smart-details-host]");
          if (!host && hidden.length) {
            host = document.createElement("span");
            host.setAttribute("data-smart-details-host", "true");
            primary.appendChild(host);
            hosts.add(host);
          }
          if (host && hidden.length) {
            const text = (cell: HTMLTableCellElement | undefined) => {
              if (!cell) return "—";
              const copy = cell.cloneNode(true) as HTMLElement;
              copy.querySelectorAll('[aria-hidden="true"], [data-smart-details-host], button').forEach((node) => node.remove());
              return copy.textContent?.trim() || "—";
            };
            next.push({ host, title: text(primary), fields: hidden.map((index) => ({ label: headings[index], value: text(row.cells[index]) })) });
          }
        });
      });
      setRows(next);
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(refresh); }
    const observer = new MutationObserver((records) => {
      if (records.some((record) => {
        const element = record.target instanceof Element ? record.target : record.target.parentElement;
        if (element?.closest("[data-smart-details-host]")) return false;
        return Boolean(element?.closest("table") || Array.from(record.addedNodes).some((node) => node instanceof Element && (node.matches("table") || node.querySelector("table"))));
      })) schedule();
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      hosts.forEach((host) => host.remove());
    };
  }, []);

  return <>
    <span ref={anchor} hidden />
    {rows.map((row, index) => createPortal(
      <Button variant="secondary" size="icon" className="smart-details-button" aria-label={`More details: ${row.title}`} title="More details" data-no-confirm="true" onClick={(event) => { event.stopPropagation(); setSelected(row); }}><ListFilter /></Button>, row.host, String(index),
    ))}
    <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle className="min-w-0 break-words">{selected?.title}</DialogTitle></DialogHeader>
        <dl className="grid gap-3 sm:grid-cols-2">{selected?.fields.map((field, index) => <div key={`${field.label}-${index}`} className="min-w-0 border-b border-border py-2"><dt className="text-xs text-muted-foreground">{field.label}</dt><dd className="mt-1 break-words text-sm font-medium">{field.value}</dd></div>)}</dl>
      </DialogContent>
    </Dialog>
  </>;
}