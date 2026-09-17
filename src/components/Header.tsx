'use client';

import { DryRunBanner } from '@/components/DryRunBanner';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/create', label: 'Compose' },
  { href: '/desk', label: 'My desk' },
  { href: '/board', label: 'Board' },
];

export function Header() {
  const pathname = usePathname();

  return (
    <>
      <DryRunBanner />
      <header className="header">
        <div className="header-inner">
          <Link className="brand" href="/">
            <span className="brand-mark">N</span>
            Night Desk
          </Link>
          <nav className="nav">
            {LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                data-active={pathname === link.href || pathname.startsWith(`${link.href}/`)}
              >
                {link.label}
              </Link>
            ))}
            <a className="pill" href="https://runtime.nyc" target="_blank" rel="noopener noreferrer">
              Runtime
            </a>
          </nav>
        </div>
      </header>
    </>
  );
}
