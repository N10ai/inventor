import test from 'node:test';
import assert from 'node:assert/strict';
import {ansellLayout,extractLayout} from '../src/layout.js';
const w=(text,x,y)=>({text,x,y,h:1});
const product=(part,qty,y)=>[w(part,5,y),w('A1',27,y),w('Long description',34,y),w('31-08-2030',53,y),w(qty,61,y),w('PR',64.2,y),w('3',69,y)];
test('grouped pallets carry across pages, join descriptions, and never become product rows',()=>{
 const result=extractLayout([{words:[w('00100530050071224549',5,40),...product('100016','432',42),w('size 10.0',34,43.5),w('No. of Cases Shipped: 275',5,94)]},{words:[w('Pallet Part #',5,12),w('Shipped Packs',61,12),...product('103478','576',20),w('00100530050071225676',5,24),...product('825768','1728',27)]}],ansellLayout());
 assert.equal(result.rows.length,3);assert.equal(result.rows[0].pallet,'00100530050071224549');assert.equal(result.rows[1].pallet,result.rows[0].pallet);assert.equal(result.rows[2].pallet,'00100530050071225676');assert.equal(result.rows[0].description,'Long description size 10.0');assert.equal(result.rows[0].qty,'432');assert.equal(result.rows[0].uom,'PR');assert.equal(result.rows[0].cases,'3');assert.equal(result.rows[1].sourcePage,2);
});
test('missing pallets and unreadable OCR quantities remain reviewable',()=>{
 const result=extractLayout([{words:product('100016','4?2',30)}],ansellLayout());assert.equal(result.rows.length,1);assert.equal(result.rows[0].qty,'4?2');assert.match(result.rows[0].warning,/Verify quantity/);assert.match(result.rows[0].warning,/Pallet missing/);
});
test('page crop excludes unrelated numeric rows',()=>{const layout=ansellLayout();layout.top=30;layout.bottom=80;const result=extractLayout([{words:[...product('REFERENCE','1234',10),...product('100016','432',40),...product('TOTAL','999',90)]}],layout);assert.equal(result.rows.length,1);assert.equal(result.rows[0].part,'100016');});
import {detectDocument} from '../src/layout.js';
test('header detection follows shifted pages and excludes document metadata',()=>{
 const page=shift=>({words:[w('Customer PO',34+shift,10),w('5295800',61+shift,10),w('Pallet',5+shift,40),w('Customer',19+shift,40),w('Lot',27+shift,40),w('Description',34+shift,40),w('Expiry',53+shift,40),w('Packs',61+shift,40),w('Cases',69+shift,40),w('Cube',76+shift,40),w('00100530050071224549',5+shift,44),...product('100016','432',46).map(a=>({...a,x:a.x+shift})),w('No. of Cases Shipped: 275',35+shift,90)]});
 const pages=[page(0),page(2)];const layout=detectDocument(pages);const result=extractLayout(pages,layout);assert.equal(result.rows.length,2);assert.equal(result.rows[1].part,'100016');assert.equal(result.rows[1].qty,'432');assert.equal(result.rows[1].uom,'PR');assert.ok(layout.top>40);assert.ok(layout.bottom<90);assert.notDeepEqual(layout.pageLayouts[0].columns,layout.pageLayouts[1].columns);
});
