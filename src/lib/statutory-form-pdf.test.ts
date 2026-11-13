import { it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildStatutoryPdf, combineStatutoryPdfs } from "./statutory-form-pdf";
it("exports all four unchanged page formats including multiline employee addresses", async () => {
  const a = await buildStatutoryPdf("esic37", {name: "Test Employee"});
  const b = await buildStatutoryPdf("accident11", {injured: "Test Employee\nPune"});
  const c = await buildStatutoryPdf("epf11", {name: "Test Employee"});
  const d = await buildStatutoryPdf("pf2", {employer: "Employer\nPune"});
  expect((await PDFDocument.load(b)).getPage(0).getWidth()).toBe(1191);
  expect((await PDFDocument.load(d)).getPageCount()).toBe(2);
  expect((await PDFDocument.load(await combineStatutoryPdfs([a,b,c,d]))).getPageCount()).toBe(5);
});