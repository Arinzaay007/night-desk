import { readFileSync } from 'node:fs';
const KEY = readFileSync('.env.local','utf8').split('\n').find(l=>l.startsWith('FLASH_API_KEY=')).slice(14).trim();
const UA='Mozilla/5.0 (NightDesk shape)';
const F='0x59F80641278f554aA921Cbc6547C1823AAFe2fB2';
const r = await fetch(`https://flash.definitive.fi/v1/orders/147b45cc-f9ac-4bf4-8f63-63de4e09c8e9?funderAddress=${F}`,{headers:{'x-definitive-api-key':KEY,'user-agent':UA}});
const d = await r.json();
console.log('GET /orders/{id} — TOP LEVEL KEYS:');
console.log(' ', Object.keys(d).join(', '));
console.log();
console.log('status at top level?', d.status);
console.log('orderId at top level?', d.orderId);
console.log('qty at top level?', d.qty);
console.log('filled at top level?', JSON.stringify(d.filled));
console.log('attachedBracket at top level?', JSON.stringify(d.attachedBracket)?.slice(0,200));
console.log('fills?', Array.isArray(d.fills) ? d.fills.length+' fills' : typeof d.fills);
console.log();
console.log('FULL STRUCTURE (values truncated):');
const walk=(o,p='',d0=0)=>{
  if (d0>3) return;
  if (Array.isArray(o)) { console.log(`${p} [array of ${o.length}]`); if(o.length) walk(o[0],p+'[0].',d0+1); return; }
  if (o && typeof o==='object') { for (const [k,v] of Object.entries(o)) {
    if (v && typeof v==='object') { console.log(`${p}${k}: ${Array.isArray(v)?'array':'object'}`); walk(v,p+'  ',d0+1); }
    else console.log(`${p}${k} = ${JSON.stringify(v)}`);
  } return; }
  console.log(`${p}${JSON.stringify(o)}`);
};
walk(d);
