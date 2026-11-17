import { describe, expect, it } from "vitest";
import { complianceFormCatalog, validateComplianceEntries, exportCompliancePdf } from "./compliance-form-catalog";
import { PDFDocument } from "pdf-lib";
describe("uploaded compliance forms", () => {
  it("retains all 45 unique formats and the duplicate source name", () => {
    expect(complianceFormCatalog).toHaveLength(45);
    expect(new Set(complianceFormCatalog.map(f => f.id)).size).toBe(45);
    expect(complianceFormCatalog.reduce((n,f) => n + 1 + f.aliases.length,0)).toBe(46);
    expect(complianceFormCatalog.filter(f => f.existingForm).map(f => f.existingForm).sort()).toEqual(["accident11","epf11","esic37","pf2"]);
  });
  it("refuses entries outside the actual source pages", () => {
    expect(validateComplianceEntries([{id:"a",page:1,x:0,y:0,text:"Test",size:10}],[{width:600,height:800}])).toBe(false);
  });
  it("exports filled text without changing original page sizes", async () => {
    const original=await PDFDocument.create();original.addPage([842,595]);
    const blob=await exportCompliancePdf(await original.save(),[{id:"a",page:0,x:40,y:40,text:"Test Employee",size:10}]);
    const output=await PDFDocument.load(await blob.arrayBuffer());
    expect(output.getPages()[0].getSize()).toEqual({width:842,height:595});
  });
});