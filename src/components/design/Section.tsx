import type { ReactNode } from 'react';
import { Reveal } from './Reveal';

export function Eyebrow({
  children,
  tone = 'ember',
  className = '',
}: {
  children: ReactNode;
  tone?: 'ember' | 'mint' | 'violet' | 'mist';
  className?: string;
}) {
  const tones = {
    ember: 'text-ember-400',
    mint: 'text-mint-400',
    violet: 'text-violet-400',
    mist: 'text-mist-400',
  } as const;

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className={`h-[5px] w-[5px] rounded-full ${tones[tone]} shadow-[0_0_12px_currentColor]`} />
      <span className={`num text-[10px] font-medium uppercase tracking-[0.32em] ${tones[tone]}`}>
        {children}
      </span>
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  accent,
  description,
  align = 'left',
  tone = 'ember',
  className = '',
  children,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  description?: string;
  align?: 'left' | 'center';
  tone?: 'ember' | 'mint' | 'violet' | 'mist';
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`${align === 'center' ? 'mx-auto max-w-[780px] text-center' : 'max-w-[720px]'} ${className}`}>
      <Reveal>
        <div className={align === 'center' ? 'flex justify-center' : ''}>
          <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
        </div>
      </Reveal>

      <Reveal delay={0.07}>
        <h2 className="mt-5 text-[32px] leading-[1.1] font-semibold tracking-[-0.032em] text-mist-50 sm:text-[42px] sm:leading-[1.06] lg:text-[50px] lg:leading-[1.03]">
          {title}
          {accent && (
            <>
              {' '}
              <span className="font-serif-it text-gradient-ember">{accent}</span>
            </>
          )}
        </h2>
      </Reveal>

      {description && (
        <Reveal delay={0.13}>
          <p className="mt-5 text-[15.5px] leading-[1.78] text-mist-400 sm:text-[17px] sm:leading-[1.74]">
            {description}
          </p>
        </Reveal>
      )}

      {children}
    </div>
  );
}
