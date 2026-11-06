const aliases = {part:['part','partnumber','partno','partnum','sku','item','itemnumber','itemno','productcode','product','material','codigo','codigoarticulo'],description:['description','desc','descripcion','productdescription','itemdescription'],qty:['qty','quantity','units','totalqty','totalquantity','cantidad','pieces','pcs'],lot:['lot','lotnumber','lotno','batch','batchno','lote'],uom:['uom','unit','unitofmeasure','unidad'],pallet:['pallet','palletno','palletnumber','palletid','tarima']};
const headerKey = s => String(s??'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function guessMapping(headers) {
  return Object.fromEntries(Object.entries(aliases).map(([field, names]) => [field, headers.findIndex(h=>names.includes(headerKey(h)))]));
}
export function extractTable(matrix) {
  const nonempty = matrix.filter(r=>r.some(c=>String(c??'').trim()));
  const index = nonempty.findIndex(row => {const m=guessMapping(row);return m.part>=0 && m.qty>=0;});
  if (index>=0) {
    // PDF text engines can split a multi-word heading into separate cells.
    const source=nonempty[index],headers=[];
    for(let i=0;i<source.length;i++){
      let length=1;
      for(let size=3;size>=2;size--)if(i+size<=source.length&&Object.values(aliases).some(names=>names.includes(headerKey(source.slice(i,i+size).join(' '))))){length=size;break;}
      headers.push(source.slice(i,i+length).join(' '));i+=length-1;
    }
    return {headers,rows:nonempty.slice(index+1).filter(row=>JSON.stringify(row)!==JSON.stringify(source)),mapping:guessMapping(headers)};
  }
  const width=Math.max(2,...nonempty.map(r=>r.length));
  const headers=Array.from({length:width},(_,i)=>`Column ${i+1}`);
  return {headers,rows:nonempty,mapping:{part:0,description:-1,qty:width-1,lot:-1,uom:-1,pallet:-1}};
}
export function parseText(text) {
  const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const matrix=lines.map(line=>line.includes('\t')?line.split(/\t+/):line.split(/\s{2,}|\s*\|\s*/));
  // OCR often collapses columns into single spaces. Preserve the source for manual review.
  if (!matrix.some(r=>r.length>1)) return extractTable(lines.map(line=>line.split(/\s+/)));
  return extractTable(matrix);
}
export function mappedRows(table, mapping) {
  return table.rows.map((r,index)=>({sourceRow:index+1,part:String(r[mapping.part]??'').trim(),description:String(r[mapping.description]??'').trim(),qty:String(r[mapping.qty]??'').replace(/,/g,'').trim(),lot:String(r[mapping.lot]??'').trim(),uom:String(r[mapping.uom]??'EA').trim().toUpperCase()||'EA',pallet:String(r[mapping.pallet]??'').trim()}));
}
// Rebuild OCR columns from word positions instead of trusting collapsed whitespace.
export function positionedText(words) {
  const widths=words.filter(w=>w.text?.length).map(w=>w.width/w.text.length).sort((a,b)=>a-b);
  const charWidth=widths[Math.floor(widths.length/2)]||8;
  const lines=[];
  for(const word of [...words].sort((a,b)=>a.y-b.y||a.x-b.x)){
    let line=lines.find(l=>Math.abs(l.y-word.y)<Math.max(3,word.height*.5));
    if(!line){line={y:word.y,words:[]};lines.push(line);}line.words.push(word);
  }
  return lines.map(line=>line.words.sort((a,b)=>a.x-b.x).map((w,i)=>{
    if(!i)return w.text;
    const prev=line.words[i-1],gap=w.x-(prev.x+prev.width);
    return (gap>charWidth*1.8?'  ':' ')+w.text;
  }).join('')).join('\n');
}
