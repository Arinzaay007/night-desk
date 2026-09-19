/**
 * Assertions for the payout verifier.
 *
 * This is the one payment in the build, so the decoder is tested against the
 * ways a receipt can look like a payment without being one: a reverted
 * transaction, a transfer to somebody else, a transfer of the wrong token, a
 * correctly-shaped payment that is simply too small, and a log that is malformed
 * enough to be a decoding crash if it were trusted.
 *
 * No network: these drive `decodeTransfers` and `judgePayout` directly.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/* Compile the module, same as the other suites — the source is TypeScript. */
const out = mkdtempSync(path.join(tmpdir(), 'nightdesk-payout-'));
const tsc = spawnSync(
  path.join(process.cwd(), 'node_modules', '.bin', 'tsc'),
  [
    'src/lib/payout-verify.ts',
    '--outDir', out,
    '--module', 'esnext',
    '--target', 'es2022',
    '--moduleResolution', 'bundler',
    '--skipLibCheck',
  ],
  { encoding: 'utf8' },
);
if (tsc.status !== 0) {
  console.error(tsc.stdout, tsc.stderr);
  process.exit(1);
}
const compiled = path.join(out, 'payout-verify.js');
const { decodeTransfers, judgePayout, TRANSFER_TOPIC } = await import(
  `file://${compiled}?v=${Date.now()}`
);

/* ------------------------------------------------------------------ */
/* harness                                                             */
/* ------------------------------------------------------------------ */

let passed = 0;
let failed = 0;

const check = (label, condition, detail = '') => {
  if (condition) {
    passed += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${label}${detail ? `  \x1b[2m${detail}\x1b[0m` : ''}`);
  } else {
    failed += 1;
    console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? `  \x1b[2m${detail}\x1b[0m` : ''}`);
  }
};

const group = title => console.log(`\n\x1b[1m${title}\x1b[0m`);

/* ------------------------------------------------------------------ */
/* fixtures                                                            */
/* ------------------------------------------------------------------ */

const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const OTHER_TOKEN = '0xb20000000000000000000078ee7ce2fe4908108c';
const AUTHOR = '0x59f80641278f554aA921Cbc6547C1823AAFe2fB2';
const OPERATOR = '0x8c2c4a5A7108Fde2B77995B8CCd76ef07a39cAb5';
const STRANGER = '0x1111111111111111111111111111111111111111';

const topic = addr => `0x${'0'.repeat(24)}${addr.slice(2).toLowerCase()}`;
const amount = micro => `0x${BigInt(micro).toString(16).padStart(64, '0')}`;

const transferLog = ({ token = USDC, from = OPERATOR, to = AUTHOR, micro = 2025 } = {}) => ({
  address: token,
  topics: [TRANSFER_TOPIC, topic(from), topic(to)],
  data: amount(micro),
});

const receipt = (over = {}) => ({
  status: '0x1',
  logs: [transferLog()],
  ...over,
});

/* ------------------------------------------------------------------ */
/* 1. decoding                                                         */
/* ------------------------------------------------------------------ */

group('1. Reading a receipt');

const one = decodeTransfers(receipt().logs);
check('a well-formed transfer decodes', one.length === 1, `${one.length}`);
check('the token is captured', one[0]?.token === USDC, one[0]?.token ?? '—');
check('the sender is captured', one[0]?.from === OPERATOR.toLowerCase(), one[0]?.from ?? '—');
check('the recipient is captured', one[0]?.to === AUTHOR.toLowerCase(), one[0]?.to ?? '—');
check('the amount is captured exactly', one[0]?.valueMicro === 2025, `${one[0]?.valueMicro}`);

check('an empty receipt decodes to nothing', decodeTransfers([]).length === 0);
check('a missing log array decodes to nothing', decodeTransfers(null).length === 0);
check(
  'a non-transfer event is ignored, not thrown on',
  decodeTransfers([{ address: USDC, topics: ['0x' + 'a'.repeat(64), topic(OPERATOR), topic(AUTHOR)], data: amount(1) }]).length === 0,
);
check(
  'a transfer missing its recipient topic is ignored',
  decodeTransfers([{ address: USDC, topics: [TRANSFER_TOPIC, topic(OPERATOR)], data: amount(1) }]).length === 0,
);
check(
  'a truncated address topic is ignored',
  decodeTransfers([{ address: USDC, topics: [TRANSFER_TOPIC, '0xabc', topic(AUTHOR)], data: amount(1) }]).length === 0,
);
check(
  'unparseable calldata is ignored, not thrown on',
  decodeTransfers([{ address: USDC, topics: [TRANSFER_TOPIC, topic(OPERATOR), topic(AUTHOR)], data: '0xzz' }]).length === 0,
);

/* ------------------------------------------------------------------ */
/* 2. the verdict                                                      */
/* ------------------------------------------------------------------ */

group('2. Deciding whether the author was paid');

const ok = judgePayout({ ...receipt(), token: USDC, author: AUTHOR, minMicro: 2025 });
check('a real payment passes', ok.ok === true, ok.reason ?? '');
check('it reports what arrived', ok.paidMicro === 2025, `${ok.paidMicro}`);
check('it reports who sent it', ok.from === OPERATOR.toLowerCase(), ok.from ?? '—');
check(
  'the author address is matched case-insensitively',
  judgePayout({ ...receipt(), token: USDC, author: AUTHOR.toLowerCase(), minMicro: 2025 }).ok === true,
);
check(
  'the token address is matched case-insensitively',
  judgePayout({ ...receipt(), token: USDC.toUpperCase().replace('0X', '0x'), author: AUTHOR, minMicro: 2025 }).ok === true,
);

const reverted = judgePayout({
  ...receipt({ status: '0x0' }),
  token: USDC,
  author: AUTHOR,
  minMicro: 2025,
});
check('a reverted transaction never counts as paid', reverted.ok === false, reverted.reason ?? '');

const wrongPayee = judgePayout({
  ...receipt({ logs: [transferLog({ to: STRANGER })] }),
  token: USDC,
  author: AUTHOR,
  minMicro: 2025,
});
check('a transfer to somebody else is refused', wrongPayee.ok === false, wrongPayee.reason ?? '');

const wrongToken = judgePayout({
  ...receipt({ logs: [transferLog({ token: OTHER_TOKEN })] }),
  token: USDC,
  author: AUTHOR,
  minMicro: 2025,
});
check('a different token is refused', wrongToken.ok === false, wrongToken.reason ?? '');

const short = judgePayout({
  ...receipt({ logs: [transferLog({ micro: 1000 })] }),
  token: USDC,
  author: AUTHOR,
  minMicro: 2025,
});
check('an underpayment is refused', short.ok === false, short.reason ?? '');
check('it says by how much', short.paidMicro === 1000, `${short.paidMicro}`);

const empty = judgePayout({ status: '0x1', logs: [], token: USDC, author: AUTHOR, minMicro: 2025 });
check('a transaction with no transfers is refused', empty.ok === false, empty.reason ?? '');

const overpaid = judgePayout({
  ...receipt({ logs: [transferLog({ micro: 5000 })] }),
  token: USDC,
  author: AUTHOR,
  minMicro: 2025,
});
check('paying more than owed still passes', overpaid.ok === true, overpaid.reason ?? '');

const split = judgePayout({
  ...receipt({ logs: [transferLog({ micro: 1000 }), transferLog({ micro: 1025 })] }),
  token: USDC,
  author: AUTHOR,
  minMicro: 2025,
});
check('two partial transfers that add up do pass', split.ok === true, `paid ${split.paidMicro}`);
check('and the total is the sum', split.paidMicro === 2025, `${split.paidMicro}`);

/* ------------------------------------------------------------------ */

console.log(
  `\n  \x1b[1m${failed === 0 ? '\x1b[32m' : '\x1b[31m'}${passed}/${passed + failed} assertions passed\x1b[0m`,
);
process.exit(failed === 0 ? 0 : 1);
