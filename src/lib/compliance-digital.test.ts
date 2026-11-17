import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { complianceFormCatalog } from './compliance-form-catalog';
import { parseDigitalDraft, digitalPrintHtml, type DigitalForm } from './compliance-digital';
const load=(id:string):DigitalForm=>JSON.parse(readFileSync(`public/compliance-digital/${id}.json`,'utf8'));
describe('digital compliance collection',()=>{
  it('contains digital replicas of all 45 unique supplied forms and all 72 pages',()=>{
    expect(readdirSync('public/compliance-digital').filter(f=>f.endsWith('.json'))).toHaveLength(45);
    let total=0;
    for(const t of complianceFormCatalog){const f=load(t.id);expect(f.id).toBe(t.id);expect(f.pages).toHaveLength(t.pages);total+=f.pages.length;}
    expect(total).toBe(72);
  });
  it('contains editable underlying text and blank fields without page images',()=>{
    for(const t of complianceFormCatalog){const f=load(t.id);expect(f.pages.reduce((n,p)=>n+p.texts.length,0)).toBeGreaterThan(0);expect(JSON.stringify(f)).not.toMatch(/data:image|pdfUrl|\.png|\.jpg/);}
    expect(load('compliance-01').pages[0].fields.length).toBeGreaterThan(0);
  });
  it('round trips changed underlying text and blank values',()=>{
    const f=load('compliance-01');const values={'0:text-0':'Edited heading','0:field-0':'Employee review value'};
    expect(parseDigitalDraft(JSON.stringify({templateId:f.id,version:1,values}),f)).toEqual(values);
  });
  it('rejects drafts belonging to a different form',()=>{
    expect(()=>parseDigitalDraft(JSON.stringify({templateId:'compliance-02',version:1,values:{}}),load('compliance-01'))).toThrow();
  });
  it('rejects unknown fields and non-text values',()=>{
    const f=load('compliance-01');for(const values of [{'0:unknown':'x'},{'0:text-0':42}])expect(()=>parseDigitalDraft(JSON.stringify({templateId:f.id,version:1,values}),f)).toThrow();
  });
  it('preserves every original page size including mixed and landscape pages',()=>{
    const html=digitalPrintHtml(['<svg/>','<svg/>'],[{width:842,height:595},{width:595,height:842}],'Review');
    expect(html).toContain('@page form0{size:842pt 595pt;margin:0}');expect(html).toContain('@page form1{size:595pt 842pt;margin:0}');
  });
});