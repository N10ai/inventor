import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {createWorker} from 'tesseract.js';
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
import {extractTable,parseText,positionedText} from './parsing.js';
export {mappedRows} from './parsing.js';
function pdfLines(items) {
  const lines=[];
  for (const item of items.filter(i=>i.str?.trim()).sort((a,b)=>b.transform[5]-a.transform[5]||a.transform[4]-b.transform[4])) {
    let line=lines.find(l=>Math.abs(l.y-item.transform[5])<3);
    if(!line){line={y:item.transform[5],items:[]};lines.push(line);} line.items.push(item);
  }
  return lines.map(l=>{
    const sorted=l.items.sort((a,b)=>a.transform[4]-b.transform[4]);
    return sorted.map((item,i)=>{
      if(!i)return item.str.trim();
      const prev=sorted[i-1],gap=item.transform[4]-(prev.transform[4]+prev.width);
      return (gap>Math.max(4,Math.abs(item.transform[0])*0.9)?'  ':' ')+item.str.trim();
    }).join('');
  }).join('\n');
}
export async function readDocument(file, progress) {
  const ext=file.name.split('.').pop().toLowerCase();
  if (ext==='xlsx') {
    const workbook=new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    return {sheets:workbook.worksheets.map(sheet=>{
      const matrix=[];
      sheet.eachRow(row=>matrix.push(Array.from({length:sheet.columnCount},(_,i)=>{
        const cell=row.getCell(i+1);const value=cell.value;
        // Preserve formatted part numbers (including leading zeros), but quantities use the raw number.
        return typeof value==='object'&&value!==null ? (value.richText?value.richText.map(x=>x.text).join(''):value.result??value.text??cell.text) : cell.text;
      })));
      return {name:sheet.name,...extractTable(matrix)};
    }),method:'Spreadsheet'};
  }
  if(['csv','tsv'].includes(ext)) {
    const parsed=Papa.parse(await file.text(),{skipEmptyLines:'greedy',delimiter:ext==='tsv'?'\t':''});
    if(parsed.errors.some(e=>e.code==='MissingQuotes'))throw new Error('The CSV has an unclosed quoted value. Please correct it and try again.');
    return {sheets:[{name:'Imported table',...extractTable(parsed.data)}],method:'Spreadsheet'};
  }
  let worker;const pages=[];
  const recognize=async image=>{
    if(!worker){worker=await createWorker('eng',1,{logger:m=>{if(m.status==='recognizing text')progress(`Reading scan · ${Math.round(m.progress*100)}%`);}});await worker.setParameters({preserve_interword_spaces:'1'});}
    const {data}=await worker.recognize(image,{}, {text:true,blocks:true});
    const words=(data.blocks||[]).flatMap(b=>b.paragraphs.flatMap(p=>p.lines.flatMap(l=>l.words))).map(w=>({text:w.text,confidence:w.confidence,x:w.bbox.x0,y:(w.bbox.y0+w.bbox.y1)/2,width:w.bbox.x1-w.bbox.x0,height:w.bbox.y1-w.bbox.y0}));
    return {text:words.length?positionedText(words):data.text,words};
  };
  try {
    if(ext==='pdf') {
      const doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
      let text='',ocr=false;
      try {
        for(let n=1;n<=doc.numPages;n++) {
          progress(`Reading page ${n} of ${doc.numPages}`);
          const page=await doc.getPage(n); const content=await page.getTextContent();
          let part=pdfLines(content.items);const viewport=page.getViewport({scale:1.5}),canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;let words=content.items.filter(i=>i.str?.trim()).map(i=>{const point=viewport.convertToViewportPoint(i.transform[4],i.transform[5]);return {text:i.str.trim(),x:point[0]/canvas.width*100,y:(point[1]-i.height*viewport.scale*.4)/canvas.height*100,h:i.height*viewport.scale/canvas.height*100};});
          if(part.trim().length<20){
            ocr=true;const scanned=await recognize(canvas.toDataURL('image/png'));part=scanned.text;words=scanned.words.map(w=>({text:w.text,confidence:w.confidence,x:w.x/canvas.width*100,y:w.y/canvas.height*100,h:w.height/canvas.height*100}));
          }
          pages.push({image:canvas.toDataURL('image/jpeg',.82),words});canvas.width=canvas.height=0;text+=part+'\n';
        }
      } finally {await doc.destroy();}
      return {sheets:[{name:'Extracted pages',...parseText(text)}],text,pages,method:ocr?'PDF + OCR':'PDF text'};
    }
    if(['png','jpg','jpeg','webp','bmp'].includes(ext)) {
      const url=URL.createObjectURL(file);let text;try{const img=new Image();img.src=url;await img.decode();const ocrCanvas=document.createElement('canvas'),ocrScale=Math.max(1,Math.min(3,3000/img.naturalWidth));ocrCanvas.width=img.naturalWidth*ocrScale;ocrCanvas.height=img.naturalHeight*ocrScale;const ocrContext=ocrCanvas.getContext('2d');ocrContext.filter='grayscale(1) contrast(1.2)';ocrContext.drawImage(img,0,0,ocrCanvas.width,ocrCanvas.height);const result=await recognize(ocrCanvas.toDataURL('image/png'));text=result.text;const canvas=document.createElement('canvas'),scale=Math.min(1,1600/img.naturalWidth);canvas.width=img.naturalWidth*scale;canvas.height=img.naturalHeight*scale;canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);pages.push({image:canvas.toDataURL('image/jpeg',.85),words:result.words.map(w=>({text:w.text,confidence:w.confidence,x:w.x/ocrCanvas.width*100,y:w.y/ocrCanvas.height*100,h:w.height/ocrCanvas.height*100}))});}finally{URL.revokeObjectURL(url);}
      return {sheets:[{name:'Extracted image',...parseText(text)}],text,pages,method:'Image OCR'};
    }
    if(ext==='txt'){const text=await file.text();return {sheets:[{name:'Text',...parseText(text)}],text,method:'Text'};}
    throw new Error('Use a PDF, Excel (.xlsx), CSV, TSV, text file, or JPG/PNG image.');
  } finally {if(worker)await worker.terminate();}
}
