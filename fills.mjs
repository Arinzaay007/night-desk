import { readFileSync } from 'node:fs';
const KEY = readFileSync('.env.local','utf8').split('\n').find(l=>l.startsWith('FLASH_API_KEY=')).slice(14).trim();
const UA='Mozilla/5.0 (NightDesk fills)';
const F='0x59F80641278f554aA921Cbc6547C1823AAFe2fB2';
async function get(o){const r=await fetch(`https://flash.definitive.fi/v1/orders/${o}?funderAddress=${F}`,{headers:{'x-definitive-api-key':KEY,'user-agent':UA}});return r.json();}
console.log('FILL DETAIL — entry order\n');
const e = await get('147b45cc-f9ac-4bf4-8f63-63de4e09c8e9');
console.log('  status:', e.status);
for (const f of (e.fills ?? [])) {
  console.log('  fill:');
  for (const [k,v] of Object.entries(f)) if (v !== null && v !== undefined && v !== '' ) console.log(`    ${k} = ${JSON.stringify(v)}`);
}
console.log('\n  --- the fee fields, isolated ---');
for (const f of (e.fills ?? [])) {
  console.log('    integratorFeeAmount:', f.integratorFeeAmount, ' <- OURS');
  console.log('    tradeFeeAmount:     ', f.tradeFeeAmount,      ' <- Definitive 10bps');
  console.log('    networkFeeAmount:   ', f.networkFeeAmount,    ' <- gas');
  console.log('    feeAmount (total):  ', f.feeAmount);
  console.log('    feeTicker:          ', f.feeTicker);
}
console.log('\nBRACKET ORDER (the protective pair)\n');
const b = await get('72b7ce84-0051-47a9-b7f9-3108982a293b');
console.log('  status:', b.status, ' type:', b.orderType, ' side:', b.side);
console.log('  qty:', b.qty);
if (b.attachedBracket?.takeProfit) console.log('  TP:', JSON.stringify(b.attachedBracket.takeProfit));
if (b.attachedBracket?.stopLoss) console.log('  SL:', JSON.stringify(b.attachedBracket.stopLoss));
console.log('  trigger:', JSON.stringify(b.trigger ?? {}));
