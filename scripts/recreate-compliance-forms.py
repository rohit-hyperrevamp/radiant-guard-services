"""Recreate source forms as browser-safe digital geometry; never embed page screenshots."""
import json, re, xml.etree.ElementTree as ET
from pathlib import Path
import pymupdf as fitz
import pytesseract
from PIL import Image
import importlib.util

ROOT = Path(__file__).resolve().parents[1]
INVENTORY = Path('/tmp/compliance-library/inventory.json')
OUTPUT = ROOT / 'public/compliance-digital'
OUTPUT.mkdir(parents=True, exist_ok=True)

def round_box(box):
    return [round(float(n), 3) for n in box]

def source_vectors(page, spans):
    """Keep exact source glyph geometry, clipping, rotation and artwork, never a page image."""
    import base64, io, cv2, numpy as np
    svg_ns = 'http://www.w3.org/2000/svg'
    link_ns = 'http://www.w3.org/1999/xlink'
    ET.register_namespace('', svg_ns)
    ET.register_namespace('xlink', link_ns)
    root = ET.fromstring(page.get_svg_image())
    prefix = f'p{page.number}-'
    for node in root.iter():
        for key, value in list(node.attrib.items()):
            if key == 'id': node.set(key, prefix + value)
            elif value.startswith('#'): node.set(key, '#' + prefix + value[1:]) if key.endswith('href') else None
            elif 'url(#' in value: node.set(key, value.replace('url(#', 'url(#' + prefix))
    parents = {child: parent for parent in root.iter() for child in parent}
    glyphs = [[] for _ in spans]
    for node in list(root.iter()):
        if node.tag == '{%s}image' % svg_ns:
            # Trace the original image's ink into closed vector contours. This retains
            # scanned lettering/logo shape without embedding any bitmap background.
            href = node.get('{%s}href' % link_ns, '')
            if not href.startswith('data:image/'):
                raise ValueError('Unexpected external image in original')
            image = Image.open(io.BytesIO(base64.b64decode(href.split(',', 1)[1])))
            parent = parents[node]
            in_mask = any(a is not None and a.tag == '{%s}mask' % svg_ns for a in (parent, parents.get(parent), parents.get(parents.get(parent))))
            if image.mode == 'RGBA':
                mask = (np.asarray(image.getchannel('A')) > 128).astype(np.uint8)
            else:
                gray = np.asarray(image.convert('L'))
                mask = (gray > 128 if in_mask else gray < 180).astype(np.uint8)
            contours, _ = cv2.findContours(mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
            commands = []
            for contour in contours:
                if len(contour) < 3: continue
                points = contour[:, 0, :]
                commands.append('M ' + ' L '.join(f'{x} {y}' for x, y in points) + ' Z')
            node.tag = '{%s}path' % svg_ns
            for key in list(node.attrib):
                if key not in ('id', 'transform', 'opacity'): del node.attrib[key]
            node.set('d', ' '.join(commands)); node.set('fill', 'white' if in_mask else 'black'); node.set('fill-rule', 'evenodd')
        if node.tag != '{%s}use' % svg_ns or 'data-text' not in node.attrib: continue
        matrix = re.search(r'matrix\(([^)]+)\)', node.get('transform', ''))
        if not matrix: continue
        coords = [float(n) for n in re.split(r'[, ]+', matrix.group(1))]
        if len(coords) != 6: continue
        x, y = coords[4:]
        candidates = [(abs(s['origin'][1]-y) + abs(s['origin'][0]-x)*.001, i)
                      for i, s in enumerate(spans) if s['box'][0]-1 <= x <= s['box'][2]+1
                      and s['box'][1]-1 <= y <= s['box'][3]+1]
        if candidates:
            _, index = min(candidates)
            glyphs[index].append(ET.tostring(node, encoding='unicode'))
            parents[node].remove(node)
    for span, fragments in zip(spans, glyphs):
        if fragments: span['sourceMarkup'] = ''.join(fragments)
    return ''.join(ET.tostring(child, encoding='unicode') for child in root)

def page_layout(page):
    spans, paths, fields, horizontal_rules, vertical_rules = [], [], [], [], []
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            for s in line['spans']:
                if not s['text'].strip() or s.get('alpha', 255) == 0:
                    continue
                font = s['font'].lower()
                text=s['text']
                if sum(0xf000<=ord(c)<=0xf0ff for c in text)>len(text)*.7:
                    # Legacy inverted ANSI symbol font used throughout the supplied Bonus PDF.
                    text=''.join(('…' if ord(c)==0xf09b else "'" if ord(c)==0xf08e else chr(((ord(c)&255)^255)+33)) if 0xf080<=ord(c)<=0xf0ff else (' ' if ord(c)==0xf020 else c) for c in text)
                if not text.strip():continue
                spans.append(dict(box=round_box(s['bbox']), origin=round_box(s['origin']), text=text, size=round(s['size'],3),
                    family='monospace' if 'courier' in font else 'serif' if (s['flags'] & 4 or any(n in font for n in ('times','cambria','roman','serif'))) else 'sans-serif',
                    bold=bool(s['flags'] & 16), italic=bool(s['flags'] & 2), color=s['color'],
                    direction=round_box(line.get('dir', (1, 0)))))
    for drawing in page.get_drawings():
        commands = []
        for item in drawing['items']:
            if item[0] == 'l':
                a,b=item[1:]; commands.append(f'M {a.x} {a.y} L {b.x} {b.y}')
                if abs(a.y-b.y)<1: horizontal_rules.append((a.y,min(a.x,b.x),max(a.x,b.x)))
                if abs(a.x-b.x)<1: vertical_rules.append((a.x,min(a.y,b.y),max(a.y,b.y)))
            elif item[0] == 're':
                r=item[1]; commands.append(f'M {r.x0} {r.y0} H {r.x1} V {r.y1} H {r.x0} Z')
                horizontal_rules.extend([(r.y0,r.x0,r.x1),(r.y1,r.x0,r.x1)])
                vertical_rules.extend([(r.x0,r.y0,r.y1),(r.x1,r.y0,r.y1)])
            elif item[0] == 'c':
                a,b,c,d=item[1:];commands.append(f'M {a.x} {a.y} C {b.x} {b.y} {c.x} {c.y} {d.x} {d.y}')
            elif item[0] == 'qu':
                q=item[1];commands.append(f'M {q.ul.x} {q.ul.y} L {q.ur.x} {q.ur.y} L {q.lr.x} {q.lr.y} L {q.ll.x} {q.ll.y} Z')
        if commands:
            paths.append(dict(d=' '.join(commands), width=drawing.get('width', .5),
                stroke=drawing.get('color'), fill=drawing.get('fill')))
    scanned = (not spans and bool(page.get_contents()) and (bool(page.get_image_info()) or bool(paths))) or (len(page.get_images()) > 10)
    if scanned:
        pix=page.get_pixmap(matrix=fitz.Matrix(3,3))
        image=Image.frombytes('RGB',[pix.width,pix.height],pix.samples)
        data=pytesseract.image_to_data(image,config='--psm 11',output_type=pytesseract.Output.DICT)
        spans=[]
        for i,text in enumerate(data['text']):
            if not text.strip(): continue
            x,y,w,h=[data[k][i]/3 for k in ('left','top','width','height')]
            spans.append(dict(box=round_box([x,y,x+w,y+h]),origin=round_box([x,y+h]),text=text,size=round(h*.95,3),family='serif',bold=False,italic=False,color=0))
        # Extract rules independently of OCR, not an image background.
        import numpy as np
        from scipy.ndimage import binary_opening, label, find_objects
        ink=np.array(image.convert('L')) < 180
        for horizontal in (() if paths else (True,False)):
            mask=binary_opening(ink,structure=np.ones((1,60) if horizontal else (60,1)))
            objects=find_objects(label(mask)[0])
            for obj in objects:
                if obj is None: continue
                ys,xs=obj;x,y,w,h=xs.start,ys.start,xs.stop-xs.start,ys.stop-ys.start
                paths.append(dict(d=f'M {x/3} {y/3} L {(x+w)/3 if horizontal else x/3} {y/3 if horizontal else (y+h)/3}',width=max(.35,min(w,h)/3),stroke=[0,0,0],fill=None))
    # Thin filled rules are common in source PDFs and missed by table parsers.
    ys=sorted(set(round(y,1) for y,a,b in horizontal_rules if b-a>15))
    xs=sorted(set(round(x,1) for x,a,b in vertical_rules if b-a>8))
    def merged(coords):
        result=[]
        for c in coords:
            if not result or c-result[-1]>2:result.append(c)
        return result
    ys,xs=merged(ys),merged(xs)
    for y0,y1 in zip(ys,ys[1:]):
        if y1-y0<8:continue
        valid=[x for x in xs if any(abs(x-v)<2 and a<=y0+2 and b>=y1-2 for v,a,b in vertical_rules)]
        for x0,x1 in zip(valid,valid[1:]):
            if x1-x0<9:continue
            if not all(any(abs(y-h)<2 and a<=x0+2 and b>=x1-2 for h,a,b in horizontal_rules) for y in [y0,y1]):continue
            r=fitz.Rect(x0+2,y0+1,x1-2,y1-1)
            occupied=any(fitz.Rect(s['box']).intersects(r) for s in spans)
            if not occupied:fields.append(dict(box=round_box(r),label=f'Table cell {len(fields)+1}',size=min(10,r.height*.55)))
    # Empty table cells are real inputs, not user-positioned annotations.
    try:
        for table in page.find_tables().tables:
            for cell in table.cells:
                if not cell: continue
                r=fitz.Rect(cell)
                if r.width<9 or r.height<8 or page.get_textbox(r).strip(): continue
                box=round_box([r.x0+2,r.y0+1,r.x1-2,r.y1-1])
                if not any(fitz.Rect(f['box']).intersects(fitz.Rect(box)) for f in fields):fields.append(dict(box=box,label=f'Table cell {len(fields)+1}',size=min(10,r.height*.55)))
    except Exception:
        pass
    # Inline dotted/underscored blanks keep their precise place.
    for s in spans:
        for match in re.finditer(r'[_\.\u2026]{4,}',s['text']):
            x0,y0,x1,y1=s['box']; n=max(1,len(s['text']))
            a=x0+(x1-x0)*match.start()/n;b=x0+(x1-x0)*match.end()/n
            if b-a>10:
                fields.append(dict(box=round_box([a,y0,b,y1]),label=s['text'][:match.start()].strip() or 'Fill-in blank',size=min(12,max(6,s['size'])),placeholder=True))
    # Horizontal lines also represent inline blanks outside tables.
    for y,a,b in horizontal_rules:
        if b-a<25:continue
        box=fitz.Rect(a+1,y-12,b-1,y-1)
        if box.y0<0 or any(fitz.Rect(s['box']).intersects(box) for s in spans):continue
        if any(fitz.Rect(f['box']).intersects(box) for f in fields):continue
        fields.append(dict(box=round_box(box),label='Fill-in line',size=9))
    artwork = source_vectors(page, spans)
    # Original outlines/scan contours already contain these letters. OCR text is
    # an editable hit target, not a second layer printed on top of the original.
    for s in spans:
        if scanned: s['outlined'] = True
    for i,s in enumerate(spans): s['id']=f'text-{i}'
    for i,f in enumerate(fields): f['id']=f'field-{i}'
    return dict(width=round(page.rect.width,3),height=round(page.rect.height,3),texts=spans,paths=paths,fields=fields,scanReview=scanned,sourceArtwork=artwork)

report=[]
for item in json.loads(INVENTORY.read_text()):
    doc=fitz.open(item['pdf'])
    if item['id'] == 'compliance-05':
        spec = importlib.util.spec_from_file_location('bonus_register', ROOT/'scripts/bonus-register-layout.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        layout = module.bonus_register()
    else:
        layout=dict(id=item['id'],version=1,pages=[page_layout(p) for p in doc])
    (OUTPUT / f"{item['id']}.json").write_text(json.dumps(layout,separators=(',',':')))
    report.append(dict(id=item['id'],pages=len(doc),texts=sum(len(p['texts']) for p in layout['pages']),fields=sum(len(p['fields']) for p in layout['pages']),scanReview=any(p['scanReview'] for p in layout['pages'])))
print(json.dumps(report,indent=2))