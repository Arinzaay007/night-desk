'use client';

import type { ProgressStep } from '@/lib/execute';

const MARK: Record<ProgressStep['status'], string> = {
  pending: '',
  active: '•',
  done: '✓',
  error: '×',
};

export function Steps({ steps }: { steps: ProgressStep[] }) {
  if (!steps.length) return null;
  return (
    <div className="steps">
      {steps.map(step => (
        <div className="step" key={step.id} data-status={step.status}>
          <span className="marker">{MARK[step.status]}</span>
          <span>{step.label}</span>
          {step.detail && <span className="detail">{step.detail}</span>}
        </div>
      ))}
    </div>
  );
}
