import { readFileSync } from 'node:fs';
const KEY = readFileSync('.env.local','utf8').split('\n').find(l=>l.startsWith('FLASH_API_KEY=')).slice(14).trim();
const r = await fetch('https://flash.definitive.fi/v1/quote',{method:'POST',headers:{'content-type':'application/json','x-definitive-api-key':KEY,'user-agent':'Mozilla/5.0 (ND)'},body:JSON.stringify({
  targetChain:'base',contraChain:'base',targetAsset:'0xb20000000000000000000078ee7ce2fe4908108c',contraAsset:'0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  side:'buy',qty:'1.35',orderType:'market',funderAddress:'0x59F80641278f554aA921Cbc6547C1823AAFe2fB2',maxSlippage:'0.03',flashIntegratorFeeBps:'25',
  attachedBracketTakeProfit:{priceDeltaBps:'2000',sellProportion:'100'},attachedBracketStopLoss:{priceDeltaBps:'800',sellProportion:'100'}})});
const q = await r.json();
const fee = Number(q.fees?.estimatedFeeNotional);
console.log('QUOTE (a fresh one, same size)');
console.log('  estimated all-in fee: $' + fee.toFixed(6), ' = ' + (fee/1.35*100).toFixed(2) + '%');
console.log('  tokens quoted:        ' + q.to?.amount);
console.log();
console.log('ACTUAL FILL (what really happened)');
console.log('  total fee:  $0.110610  = 8.19%');
console.log('    your 25bps     $0.003375');
console.log('    Definitive 10bps $0.001351');
console.log('    network/route   $0.105884   <-- the bulk');
console.log();
console.log('VERDICT');
console.log('  the whole -8.4% P&L move IS the fee.');
console.log('  $0.1106 fee on $1.35 = 8.19%, and the position is down 8.4%.');
console.log('  the market barely moved; the fee is the loss.');
