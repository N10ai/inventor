// Coordinates are percentages, so saved layouts work at different scan resolutions.
export const fields = [['part','Part number'],['description','Description'],['qty','Quantity'],['uom','UOM'],['lot','Lot / batch'],['pallet','Pallet / group'],['cases','Cases / cartons'],['expiry','Expiry date']];
export function ansellLayout(){return {top:0,bottom:96,grouped:true,palletPattern:'^\\d{16,22}$',columns:{part:[4.5,18],lot:[26.5,31],description:[33.5,51.5],expiry:[51.5,59],qty:[60,64],uom:[64,66],cases:[67,72],pallet:[4.5,19]}};}
export function genericLayout(){return {top:0,bottom:100,grouped:false,palletPattern:'^\\d{16,22}$',columns:{part:[0,20],description:[20,55],qty:[55,70],lot:[70,85],uom:[85,100]}};}
function linesOf(words){const lines=[];for(const w of [...words].sort((a,b)=>a.y-b.y||a.x-b.x)){let line=lines.find(l=>Math.abs(l.y-w.y)<Math.max(.45,(w.h||1)*.6));if(!line){line={y:w.y,words:[]};lines.push(line);}line.words.push(w);}return lines.map(l=>({...l,words:l.words.sort((a,b)=>a.x-b.x)}));}
export function extractLayout(pages,layout){
 let pallet='',previous=null;const rows=[],warnings=[];let pattern;try{pattern=new RegExp(layout.palletPattern||'^\\d{16,22}$');}catch{throw new Error('Pallet pattern is not a valid regular expression.');}
 for(let pageIndex=0;pageIndex<pages.length;pageIndex++){
 previous=null;
 for(const line of linesOf(pages[pageIndex].words||[])){
 if(line.y<layout.top||line.y>layout.bottom)continue;
 const get=k=>{const range=layout.columns[k];return range?line.words.filter(w=>w.x>=range[0]&&w.x<range[1]).map(w=>w.text).join(' ').trim():'';};
 const full=line.words.map(w=>w.text).join(' ');
 const group=get('pallet')||get('part');
 if(layout.grouped&&pattern.test(group)&&!get('qty')){pallet=group;previous=null;continue;}
 if(/(?:no\. of|total|page\s*:?\s*\d|shipped\s+(packs|cases))/i.test(full)){previous=null;continue;}
 const part=get('part'),rawQty=get('qty').replaceAll(',',''),match=rawQty.match(/^(\d+(?:\.\d+)?)\s*([A-Za-z]+)?$/);
 if(part&&(match||(/\d/.test(rawQty)&&rawQty&&!/total|date|packs|quantity/i.test(rawQty)))&&!/^(part|item|sku|pallet|customer)$/i.test(part)){
 const row={part,description:get('description'),qty:match?.[1]||rawQty,uom:get('uom')||match?.[2]||'',lot:get('lot'),pallet:layout.grouped?pallet:get('pallet'),cases:get('cases'),expiry:get('expiry'),sourcePage:pageIndex+1};
 row.warning=[line.words.some(w=>w.confidence!==undefined&&w.confidence<80)?'Check OCR against original':'',!match?'Verify quantity':'',!row.uom?'Verify UOM':'',layout.grouped&&!row.pallet?'Pallet missing':'',row.cases&&!/^\d+(\.\d+)?$/.test(row.cases)?'Verify cases':''].filter(Boolean).join(' · ');
 rows.push(row);previous=row;
 }else if(!part&&!rawQty&&get('description')&&previous&&line.y-(previous.lastY??line.y)<2.5){previous.description+=' '+get('description');}
 else if(part&&/\d/.test(part)&&!pattern.test(part)&&rawQty){warnings.push(`Page ${pageIndex+1}: skipped a row with unreadable quantity (${part}).`);previous=null;}
 if(previous)previous.lastY=line.y;
 }
 }
 return {rows:rows.map(({lastY,...r})=>r),warnings};
}
