import { readFileSync } from 'node:fs';
const KEY = readFileSync('.env.local','utf8').split('\n').find(l=>l.startsWith('FLASH_API_KEY=')).slice(14).trim();
const UA = 'Mozilla/5.0 (NightDesk verify)';
const FUNDER = '0x59F80641278f554aA921Cbc6547C1823AAFe2fB2';
const USDC='0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const NVDA='0xb20000000000000000000078ee7ce2fe4908108c';
async function api(path){
  const r = await fetch('https://flash.definitive.fi/v1'+path, { headers:{ 'x-definitive-api-key':KEY, 'user-agent':UA } });
  return { status: r.status, body: await r.json().catch(()=>({})) };
}
async function rpc(m,p){
  const r = await fetch('https://mainnet.base.org',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:m,params:p}),signal:AbortSignal.timeout(15000)});
  const j = await r.json(); if(j.error) throw new Error(j.error.message); return j.result;
}
console.log('1. THE ORDER, READ BACK FROM FLASH\n');
const list = await api(`/orders?funderAddress=${FUNDER}&pageSize=5`);
const orders = list.body.orders ?? list.body ?? [];
if (!Array.isArray(orders) || !orders.length) console.log('  raw:', JSON.stringify(list.body).slice(0,300));
for (const o of (Array.isArray(orders)?orders:[]).slice(0,3)) {
  console.log(`  orderId   ${o.orderId}`);
  console.log(`  status    ${o.status}   type ${o.orderType}   side ${o.side}`);
  console.log(`  qty       ${o.qty}    filled ${JSON.stringify(o.filled ?? {})}`);
  if (o.attachedBracket) {
    console.log(`  BRACKET   status=${o.attachedBracket.status} id=${o.attachedBracket.bracketOrderId}`);
    console.log(`    takeProfit ${o.attachedBracket.takeProfit?.notionalPrice}   stopLoss ${o.attachedBracket.stopLoss?.notionalPrice}`);
  }
  const fills = o.fills ?? [];
  console.log(`  fills     ${fills.length}`);
  for (const f of fills) {
    console.log(`    notional=${f.notional} price=${f.fillPrice}`);
    console.log(`    tx=${f.transactionId}`);
    console.log(`    integratorFee=${f.integratorFeeAmount} totalFee=${f.feeAmount} ticker=${f.feeTicker}`);
  }
  console.log('');
}
console.log('2. DID THE MONEY ACTUALLY MOVE?\n');
const eth = Number(BigInt(await rpc('eth_getBalance',[FUNDER,'latest'])))/1e18;
const data = '0x70a08231'+FUNDER.slice(2).toLowerCase().padStart(64,'0');
const usdc = Number(BigInt((await rpc('eth_call',[{to:USDC,data},'latest']))||'0x0'))/1e6;
const nvda = Number(BigInt((await rpc('eth_call',[{to:NVDA,data},'latest']))||'0x0'))/1e8;
console.log(`  USDC   $${usdc.toFixed(4)}   (was $1.3500)`);
console.log(`  NVDAc  ${nvda.toFixed(8)}   (was 0)`);
console.log(`  ETH    ${eth.toFixed(8)}   (was 0.00004000)`);
if (usdc < 1.35) console.log(`\n  >>> MONEY MOVED: spent $${(1.35-usdc).toFixed(4)} USDC`);
if (nvda > 0) console.log(`  >>> STOCK RECEIVED: ${nvda.toFixed(8)} NVDAc`);
console.log(`  >>> GAS BURNED: $${((0.00004-eth)*2503).toFixed(6)}`);
