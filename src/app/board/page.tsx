import Link from 'next/link';
import { Header } from '@/components/Header';
import { loadBoardRows } from '@/lib/plans';
import { BoardTable } from './BoardTable';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The board.
 *
 * Rows are read server-side so the table is real content in the first paint;
 * only the performance numbers, which cost an exchange round trip each, arrive
 * afterwards.
 */
export default async function BoardPage() {
  const { rows, total } = await loadBoardRows();

  return (
    <>
      <Header />
      <main className="shell">
        <section style={{ padding: '40px 0 20px' }}>
          <p className="eyebrow">Board</p>
          <h1 style={{ fontSize: 34 }}>Plans, ranked by the money their mirrors actually booked.</h1>
          <p className="lede" style={{ fontSize: 16 }}>
            Every row is a plan published through Night Desk and run by at least one wallet. Ranking
            reads the fills back from the exchange — realised profit is what settled, not what was
            quoted. The exchange scopes order reads to a funder address, so there is no global feed
            of Flash trades to index: a plan has to be published to be shareable, which makes this
            the only honest version of this number.
          </p>
        </section>

        <section className="section" style={{ paddingTop: 10 }}>
          {rows.length === 0 ? (
            <div className="card">
              <p style={{ marginBottom: 12 }}>
                Nothing published yet. The first plan you compose shows up here the moment it is
                mirrored.
              </p>
              <Link className="button small" href="/create">
                Publish the first one
              </Link>
            </div>
          ) : (
            <BoardTable rows={rows} />
          )}

          <p className="tiny dim" style={{ marginTop: 16 }}>
            {total > 0 && (
              <>
                {total} mirrored {total === 1 ? 'position' : 'positions'} behind this board.{' '}
              </>
            )}
            Realised figures come only from fills that actually settled; unrealised is the part still
            held, marked at the current market. A plan whose mirrors cannot be read back is reported
            as <em>unreadable</em> rather than quietly ranked at zero, and plans that failed to price
            keep their retry button.
          </p>
        </section>
      </main>
    </>
  );
}
