"""Reviewed Form C register: natural text, real entry rows, explicit factual fields."""
import json
from pathlib import Path
import pymupdf as fitz

def bonus_register():
    texts, paths, fields = [], [], []
    def text(value, x, y, width, size=9, bold=False):
        texts.append(dict(id=f'text-{len(texts)}', text=value, box=[x,y-size,x+width,y+2],
                          origin=[x,y],size=size,family='Arial, sans-serif',bold=bold,italic=False,color=0))
    def rule(x, y, x1, y1):
        paths.append(dict(d=f'M {x} {y} L {x1} {y1}',width=.5,stroke=[0,0,0],fill=None))
    def field(id, label, box, fact=None):
        value=dict(id=id,label=label,box=box,size=9)
        if fact: value['factKey']=fact
        fields.append(value)
    text('FORM C',280,102,65,12,True)
    text('{See rule 4(c)}',276,116,95,9)
    text('Bonus paid to employees for the accounting year ending on the',86,140,398,9,True)
    field('accounting-year','Accounting year ending',[485,130,555,144])
    text('Name of the establishment',86,161,145)
    field('establishment','Name of the establishment',[234,150,556,168],'employerName')
    text('No. of working days in the year',86,180,170)
    field('year-working-days','Working days in the accounting year',[259,170,556,186])
    first=[('S. No.',24),('Name of the\nEmployee',72),("Father’s\nname",64),('Whether he has\ncompleted 15\nyears of age at\nthe beginning of\nthe accounting\nyear',70),('Designation',64),('No. of days\nworked in\nthe year',50),('Total salary\nor wage in\nrespect of the\naccounting\nyear',66),('Amount of\nbonus payable\nunder section\n10 or section 11\nas the case\nmay be', 60)]
    second=[('Puja bonus or\nother customary\nbonus during the\naccounting year',55),('Interim bonus\nor bonus paid\nin advance',55),('Amount of\nincome-tax\ndeducted',56),('Deduction on\naccount of\nfinancial loss,\nif any, caused\nby misconduct\nof the employee',65),('Total sum\ndeducted under\nColumns 9,\n10, 10 A\nand 11',52),('Net amount\npayable\n(column 8\nminus\nColumn 12)',55),('Amount\nactually\npaid',43),('Date on\nwhich paid',43),('Signature /\nThumb\nimpression of\nthe employee',46)]
    def table(columns, top, header_height, ids, facts, numbers):
        x=86; total=sum(w for _,w in columns); bottom=top+header_height+15+34
        rule(x,top,x+total,top);rule(x,top+header_height,x+total,top+header_height)
        rule(x,top+header_height+15,x+total,top+header_height+15);rule(x,bottom,x+total,bottom)
        for (label,w),id,fact,number in zip(columns,ids,facts,numbers):
            rule(x,top,x,bottom)
            lines=[]
            for paragraph in label.split('\n'):
                line=''
                for word in paragraph.split():
                    candidate=(line+' '+word).strip()
                    if line and fitz.get_text_length(candidate,fontname='helv',fontsize=8)>w-6:
                        lines.append(line);line=word
                    else: line=candidate
                lines.append(line)
            for n,line in enumerate(lines): text(line,x+3,top+12+n*10,w-6,8)
            text(str(number),x+3,top+header_height+11,w-6,8)
            field(id,label.replace('\n',' '),[x+3,top+header_height+18,x+w-3,bottom-3],fact)
            x+=w
        rule(x,top,x,bottom)
    table(first,197,100,['serial','employee-name','father-name','age-qualified','designation','days-worked','year-wages','bonus-payable'],[None,'name','father',None,'designation',None,None,None],range(1,9))
    table(second,367,120,['puja-bonus','interim-bonus','income-tax','financial-loss','total-deductions','net-payable','amount-paid','paid-date','signature'],[None]*9,['9','10','10 A','11','12','13','14','15','16'])
    text('¹ Ins by G.S.R 1147 dated 23rd August, 1979 (w.e.f. 8-9-1979)',86,725,470,8)
    return dict(id='compliance-05',version=1,pages=[dict(width=612,height=792,texts=texts,paths=paths,fields=fields,scanReview=False)])

if __name__=='__main__':
    root=Path(__file__).resolve().parents[1]
    (root/'public/compliance-digital/compliance-05.json').write_text(json.dumps(bonus_register(),separators=(',',':')))