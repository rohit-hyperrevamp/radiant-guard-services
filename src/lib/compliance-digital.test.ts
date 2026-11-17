import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { complianceFormCatalog } from './compliance-form-catalog';
import { parseDigitalDraft, digitalPrintHtml, digitalFieldLines, digitalAnswerLayout, type DigitalForm } from './compliance-digital';
import { reviewedDigitalLayout } from './compliance-reviewed-layout';
const load=(id:string):DigitalForm=>JSON.parse(readFileSync(`public/compliance-digital/${id}.json`,'utf8'));
describe('digital compliance collection',()=>{
  it('keeps compatible old wage-slip drafts and rejects conflicting merged answers',()=>{
    const form=reviewedDigitalLayout(load('compliance-30'));
    const draft=(values:Record<string,string>)=>JSON.stringify({templateId:form.id,version:1,values});
    expect(parseDigitalDraft(draft({'0:field-0':'Test Employee','0:field-1':''}),form)).toEqual({'0:field-0':'Test Employee'});
    expect(()=>parseDigitalDraft(draft({'0:field-0':'Employee One','0:field-1':'Employee Two'}),form)).toThrow();
  });
  it('source-reviewed certificate blanks have distinct employee fields inside the paper',()=>{
    const form=reviewedDigitalLayout(load('compliance-36'));
    expect(form.pages[0].fields.find(f=>f.id==='review-name')?.factKey).toBe('name');
    expect(form.pages[0].fields.find(f=>f.id==='review-permanent-address')?.factKey).toBe('address');
    expect(form.pages[0].fields.find(f=>f.id==='review-present-address')?.factKey).toBeUndefined();
    for(const f of form.pages[0].fields){expect(f.box[0]).toBeGreaterThanOrEqual(0);expect(f.box[2]).toBeLessThanOrEqual(612);expect(f.box[3]).toBeLessThanOrEqual(792);}
  });
  it('fits names by measured glyph width without stretching or crossing the blank',()=>{
    const measure=(text:string,size:number)=>Array.from(text).reduce((n,c)=>n+(c==='W'?1:c==='i'?.2:.5),0)*size;
    const layout=digitalAnswerLayout('WW iii WW',[10,20,40,44],10,measure);
    expect(layout.x).toBe(10);expect(layout.baseline).toBeGreaterThan(20);expect(layout.overflow).toBe(false);
    expect(layout.lines.length).toBeGreaterThan(1);for(const line of layout.lines)expect(measure(line,layout.size)).toBeLessThanOrEqual(30);
    expect(layout.baseline+(layout.lines.length-1)*layout.size*1.15).toBeLessThan(44);
  });
  it('rejects an answer whose first glyph cannot fit a narrow source cell',()=>{
    expect(digitalFieldLines('W',[0,0,1,10],9,(_text,size)=>size).overflow).toBe(true);
  });
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