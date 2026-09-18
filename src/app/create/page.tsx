'use client';

import { PlanForm } from '@/components/PlanForm';
import { WalletBar } from '@/components/WalletBar';
import { useWallet } from '@/lib/useWallet';

export default function CreatePage() {
  const wallet = useWallet();

  return (
    <>
      <main className="shell">
        <section style={{ padding: '40px 0 24px' }}>
          <div className="spread">
            <div>
              <p className="eyebrow">Compose</p>
              <h1 style={{ fontSize: 34 }}>Build a plan people can mirror.</h1>
              <p className="lede" style={{ fontSize: 16 }}>
                You set the shape — asset, size as a share of the wallet, and the two levels that
                define the trade. Everyone who mirrors gets their own version of it.
              </p>
            </div>
          </div>
          <div style={{ marginTop: 20 }}>
            <WalletBar wallet={wallet} />
          </div>
        </section>

        <PlanForm mode="create" wallet={wallet} />

        <section className="section">
          <p className="tiny dim">
            Publishing costs nothing beyond the trade itself. The platform charges a small fee on
            execution which is surfaced in the preview, and a share of it is credited to the plan
            author as their plans get mirrored.
          </p>
        </section>
      </main>
    </>
  );
}
