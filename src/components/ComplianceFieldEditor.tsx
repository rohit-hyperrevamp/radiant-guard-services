import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type ComplianceEntry = { key: string; label: string; initial: string; page: number; options?: string[] };
export function ComplianceFieldEditor({ items, selected, onSelect, values, onChange, onRestore, facts = {} }: {
  items: ComplianceEntry[]; selected: string; onSelect: (key: string) => void; values: Record<string,string>;
  onChange: (key:string,value:string) => void; onRestore: (key:string) => void; facts?: Record<string,string>;
}) {
  const active = items.find(item=>item.key===selected);
  return <div className="min-w-0 space-y-4">
    <div className="space-y-2"><Label>Form field</Label><Select value={selected} onValueChange={onSelect}><SelectTrigger className="w-full min-w-0"><SelectValue placeholder="Choose a field"/></SelectTrigger><SelectContent>{items.map(item=><SelectItem key={item.key} value={item.key}>Page {item.page+1} · {item.label || 'Field value'}</SelectItem>)}</SelectContent></Select></div>
    {active&&<div className="space-y-3"><Label htmlFor="compliance-field-value">{active.label || 'Field value'} · page {active.page+1}</Label>{active.options ? <Select value={values[active.key]??''} onValueChange={value=>onChange(active.key,value)}><SelectTrigger><SelectValue placeholder="Choose"/></SelectTrigger><SelectContent>{active.options.map(option=><SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select> : <Textarea id="compliance-field-value" value={values[active.key]??active.initial} onChange={e=>onChange(active.key,e.target.value)} rows={4}/>}<Button variant="outline" onClick={()=>onRestore(active.key)}><RotateCcw className="mr-2 h-4 w-4"/>Restore field</Button></div>}
    {Object.values(facts).some(Boolean)&&<div className="space-y-2"><Label>Saved information</Label><Select value="" disabled={!active||!!active.options} onValueChange={key=>{if(active)onChange(active.key,facts[key]??'');}}><SelectTrigger className="w-full min-w-0"><SelectValue placeholder="Insert saved information"/></SelectTrigger><SelectContent>{Object.entries(facts).filter(([,value])=>value).map(([key,value])=><SelectItem key={key} value={key}>{key.replaceAll('_',' ')}: {value}</SelectItem>)}</SelectContent></Select></div>}
  </div>;
}