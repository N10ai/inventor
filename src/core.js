export const id = () => crypto.randomUUID?.() || '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
export const normalize = value => String(value ?? '').trim().toUpperCase();
export const itemKey = row => JSON.stringify([normalize(row.part), normalize(row.lot), normalize(row.uom || 'EA')]);
export function validQuantity(value) {
  if (String(value).trim() === '') return false;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}
export function reconcile(job) {
  const items = new Map();
  const take = row => {
    const key = itemKey(row);
    if (!items.has(key)) items.set(key, {key, part: row.part, description: row.description || '', lot: row.lot || '', uom: row.uom || 'EA', expected: 0, actual: 0, listed: false, counted: false, pallets: new Set()});
    return items.get(key);
  };
  for (const row of job.expected) { const item = take(row); item.expected += Number(row.qty); item.listed = true; }
  for (const pallet of job.pallets) for (const row of pallet.counts) {
    const item = take(row); item.actual += Number(row.qty); item.counted = true; item.pallets.add(pallet.name);
    if (!item.description) item.description = row.description || '';
  }
  const final = job.pallets.length > 0 && job.pallets.every(p => p.complete);
  return [...items.values()].map(item => ({...item, pallets: [...item.pallets], variance: item.actual - item.expected,
    status: !item.listed ? 'Unexpected' : !final ? (!item.counted ? 'Not counted' : item.actual > item.expected ? 'Overage' : item.actual === item.expected ? 'Matched' : 'In progress') : item.actual < item.expected ? 'Shortage' : item.actual > item.expected ? 'Overage' : 'Matched'
  }));
}
export function totalsByUom(rows, field) {
  const totals = new Map();
  for (const row of rows) totals.set(row.uom || 'EA', (totals.get(row.uom || 'EA') || 0) + Number(row[field] || 0));
  return [...totals].map(([unit, qty]) => `${qty.toLocaleString()} ${unit}`).join(' · ') || '0';
}
export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function reportCsv(job, detailed = false) {
  const rows = detailed ? [['Pallet','Complete','Part number','Description','Lot','UOM','Quantity','Condition','Notes','Counted at','Outer quantity','Outer UOM','Inner quantity per outer','Inner UOM','Units per inner'],
    ...job.pallets.flatMap(p => p.counts.map(c => [p.name,p.complete?'Yes':'No',c.part,c.description,c.lot,c.uom,c.qty,c.condition,c.notes,c.at,c.packages??'',c.packaging?.outer??'',c.packaging?.innerQty??'',c.packaging?.inner??'',c.packaging?.units??c.units??'']))]
    : [['Part number','Description','Lot','UOM','Expected','Counted','Variance','Status','Pallets','Listed cases (source)','Expiry dates (source)'], ...reconcile(job).map(r => [r.part,r.description,r.lot,r.uom,r.expected,r.actual,r.variance,r.status,r.pallets.join('; '),job.expected.filter(x=>itemKey(x)===r.key).map(x=>x.cases||'').filter(Boolean).join('; '),job.expected.filter(x=>itemKey(x)===r.key).map(x=>x.expiry||'').filter(Boolean).join('; ')])];
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}
export function newJob(name, customer, palletCount = 1) {
  return {id:id(),name,customer,reference:'',created:new Date().toISOString(),expected:[],sources:[],pallets:Array.from({length:palletCount}, (_, i)=>({id:id(),name:`P${String(i+1).padStart(2,'0')}`,complete:false,counts:[]}))};
}
export function demoJob() {
  const job = newJob('Miami inbound consolidation', 'Acme Industrial Supply', 24);
  job.reference = 'WR-1048'; job.demo = true;
  job.expected = [{part:'BRG-6204',description:'Sealed ball bearing',lot:'L2608',uom:'EA',qty:240},{part:'FLT-100',description:'Hydraulic filter',lot:'B142',uom:'EA',qty:120},{part:'VLV-025',description:'Brass valve 25 mm',lot:'V09',uom:'EA',qty:80},{part:'BLT-M12',description:'Hex bolt M12',lot:'',uom:'EA',qty:500}];
  const add=(i,row,qty)=> job.pallets[i].counts.push({...job.expected[row],id:id(),qty,condition:'Good',notes:'',at:new Date().toISOString()});
  add(0,0,60);add(0,1,30);add(1,0,100);add(1,2,40);add(2,0,80);add(2,1,40);add(3,1,55);add(3,3,200);add(4,3,150);
  job.pallets.slice(0,4).forEach(p=>p.complete=true);
  return job;
}
