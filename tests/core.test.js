import test from 'node:test';
import assert from 'node:assert/strict';
import {newJob,reconcile,reportCsv,csvCell,validQuantity,totalsByUom} from '../src/core.js';
import {extractTable,parseText,mappedRows} from '../src/parsing.js';
const item=(part,qty,lot='A',uom='EA')=>({part,qty,lot,uom});
test('same part and lot spread over 24 mixed pallets totals without losing locations',()=>{
 const job=newJob('Inbound','Customer',24);job.expected=[item('PN-1',100),item('PN-2',40)];
 job.pallets[0].counts=[item('PN-1',20),item('PN-2',10)];job.pallets[7].counts=[item('pn-1',30)];job.pallets[23].counts=[item('PN-1',50)];
 const row=reconcile(job).find(r=>r.part==='PN-1');assert.equal(row.actual,100);assert.equal(row.status,'Matched');assert.deepEqual(row.pallets,['P01','P08','P24']);
});
test('lots and units never merge',()=>{const j=newJob('Test','',1);j.expected=[item('X',10,'A'),item('X',20,'B'),item('X',3,'A','CTN')];j.pallets[0].counts=[item('X',10,'A')];assert.equal(reconcile(j).length,3);assert.equal(totalsByUom(reconcile(j),'expected'),'30 EA · 3 CTN');});
test('shortages are final only when all pallets complete, and reopen returns to in progress',()=>{const j=newJob('Test','',2);j.expected=[item('X',100),item('Y',5)];j.pallets[0].counts=[item('X',10)];assert.deepEqual(reconcile(j).map(r=>r.status),['In progress','Not counted']);j.pallets.forEach(p=>p.complete=true);assert.deepEqual(reconcile(j).map(r=>r.status),['Shortage','Shortage']);j.pallets[1].complete=false;assert.equal(reconcile(j)[0].status,'In progress');});
test('overages and unexpected stock show during counting',()=>{const j=newJob('Test','');j.expected=[item('X',5)];j.pallets[0].counts=[item('X',6),item('Y',2)];assert.deepEqual(reconcile(j).map(r=>r.status),['Overage','Unexpected']);});
test('duplicate expected rows and count entries add correctly',()=>{const j=newJob('Test','');j.expected=[item('X',5),item('X',7)];j.pallets[0].counts=[item('X',4),item('X',8)];assert.equal(reconcile(j)[0].expected,12);assert.equal(reconcile(j)[0].actual,12);});
test('CSV safely escapes formulas, quotes, commas and preserves report rows',()=>{assert.equal(csvCell('=HYPERLINK("x")'),'"\'=HYPERLINK(""x"")"');const j=newJob('Test','');j.pallets[0].counts=[{...item('X,1',4),notes:'a\nb',condition:'Good'}];assert.match(reportCsv(j,true),/"X,1"/);assert.match(reportCsv(j),/Unexpected/);});
test('invalid quantities reject blank, negative, infinite and nonnumeric input',()=>{for(const v of ['', ' ', -1, Infinity,'abc'])assert.equal(validQuantity(v),false);for(const v of [0,12,'0','1.5'])assert.equal(validQuantity(v),true);});
test('packing list header detection skips shipper preamble and maps columns',()=>{const t=extractTable([['ACME SHIPPING'],['Part No.','Description','Qty','Lot','UOM','Pallet'],['00123','Bearing','1,000','A','EA','P01']]);assert.equal(t.mapping.part,0);assert.equal(t.mapping.qty,2);const rows=mappedRows(t,t.mapping);assert.equal(rows[0].part,'00123');assert.equal(rows[0].qty,'1000');assert.equal(rows[0].pallet,'P01');});
test('PDF aligned text and OCR fallback remain reviewable',()=>{const table=parseText('Part No  Description  Qty  Lot\nX-1  Bearing  12  A');assert.equal(mappedRows(table,table.mapping)[0].qty,'12');const ocr=parseText('SKU Qty\nX-1 4');assert.equal(mappedRows(ocr,ocr.mapping)[0].part,'X-1');});
test('split PDF column headings repair without shifting quantity columns',()=>{const t=parseText('Part  Number  Description  Qty  Lot  UOM\nBRG-6204  Sealed bearing  240  L2608  EA');const r=mappedRows(t,t.mapping)[0];assert.equal(r.part,'BRG-6204');assert.equal(r.description,'Sealed bearing');assert.equal(r.qty,'240');assert.equal(r.lot,'L2608');});
