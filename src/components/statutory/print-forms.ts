/**
 * Prints the on-screen digital form (vector text, exact layout) through a private iframe,
 * so the browser's "Save as PDF" produces the same pages the user edited.
 */
export async function printStatutorySheets(root: HTMLElement, title: string, draft: boolean) {
  const sheets = Array.from(root.querySelectorAll<HTMLElement>(".stat-sheet"));
  if (!sheets.length) throw new Error("Nothing to print");
  const size = sheets[0].dataset.size ?? "210mm 297mm";
  const clone = root.cloneNode(true) as HTMLElement;
  // Inputs keep live values only as properties; copy them into the markup.
  const src = root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
  clone.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea").forEach((el, i) => {
    const original = src[i];
    if (el instanceof HTMLTextAreaElement) el.textContent = original.value;
    else el.setAttribute("value", original.value);
    el.setAttribute("style", `${el.getAttribute("style") ?? ""};font-size:${getComputedStyle(original).fontSize}`);
  });
  if (draft) clone.querySelectorAll(".stat-sheet").forEach(s => {
    const mark = document.createElement("div");
    mark.textContent = "DRAFT - Missing details / declarations / signatures must be verified before submission";
    mark.setAttribute("style", "position:absolute;left:24pt;bottom:6pt;font:7pt Arimo,Arial,sans-serif;color:#555");
    s.appendChild(mark);
  });
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  const head = Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).map(n => n.outerHTML).join("");
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, "")}</title>${head}<style>@page{size:${size};margin:0}html,body{margin:0;padding:0;background:#fff}.stat-print{display:block!important}.stat-print>*{gap:0!important;padding:0!important}.stat-sheet{box-shadow:none!important;break-after:page;page-break-after:always}.stat-sheet:last-child{break-after:auto;page-break-after:auto}</style></head><body><div class="stat-print">${clone.innerHTML}</div></body></html>`);
  doc.close();
  await new Promise(r => setTimeout(r, 50));
  await doc.fonts?.ready;
  await Promise.all(Array.from(doc.images).map(img => img.complete ? null : new Promise(r => { img.onload = img.onerror = r; })));
  frame.contentWindow!.focus();
  frame.contentWindow!.print();
  setTimeout(() => frame.remove(), 60_000);
}
