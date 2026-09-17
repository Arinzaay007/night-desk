import { NextResponse, type NextRequest } from 'next/server';
import { groupPlans } from '@/lib/plans';
import { listMirrors, mirrorsForPlan } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Board rows as JSON.
 *
 * The board page reads the same grouping helper server-side; this route exists
 * so the data is inspectable without a browser, which is what the preflight and
 * anyone auditing the board will want.
 */
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('planKey');
  const mirrors = key ? await mirrorsForPlan(key) : await listMirrors();

  return NextResponse.json({
    ok: true,
    plans: groupPlans(mirrors),
    total: mirrors.length,
  });
}
