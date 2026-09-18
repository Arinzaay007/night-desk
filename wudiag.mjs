import { readFileSync } from 'node:fs';
const KEY = readFileSync('.env.local','utf8').split('\n').find(l=>l.startsWith('FLASH_API_KEY=')).slice(14).trim();
const F='0x8c2c4a5A7108Fde2B77995B8CCd76ef07a39cAb5';
async function q(label, body){
  const r = await fetch('https://flash.definitive.fi/v1/quote',{method:'POST',headers:{'content-type':'application/json','x-definitive-api-key':KEY,'user-agent':'Mozilla/5.0 (ND)'},body:JSON.stringify(body)});
  const j = await r.json();
  console.log(`\n${label}  -> HTTP ${r.status}`);
  if (r.ok) console.log('  OK, approveTx:', j.evm?.approveTx ? 'present' : 'NONE', '| bracket approveTx:', j.attachedBracket?.evm?.approveTx ? 'present' : 'NONE');
  else console.log('  ', JSON.stringify(j).slice(0,400));
  return r.status;
}
const base = { targetChain:'base', contraChain:'base', targetAsset:'0xb20000000000000000000078ee7ce2fe4908108c', contraAsset:'0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', side:'buy', orderType:'market', funderAddress:F, maxSlippage:'0.03' };

await q('A. warmup as written: $0.05 + legacy price-based bracket', {
  ...base, qty:'0.05',
  attachedBracket:{ takeProfit:{notionalPrice:'999999'}, stopLoss:{notionalPrice:'0.01'} },
});
await q('B. same but NO bracket', { ...base, qty:'0.05' });
await q('C. $0.05 + the bps form used elsewhere', {
  ...base, qty:'0.05',
  attachedBracketTakeProfit:{priceDeltaBps:'2000',sellProportion:'100'},
  attachedBracketStopLoss:{priceDeltaBps:'800',sellProportion:'100'},
});
await q('D. $1.35 + legacy price-based bracket (size test)', {
  ...base, qty:'1.35',
  attachedBracket:{ takeProfit:{notionalPrice:'999999'}, stopLoss:{notionalPrice:'0.01'} },
});
