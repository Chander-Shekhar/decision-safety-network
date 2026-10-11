import type { ReactNode } from 'react';

export interface BadgeProps {
  tone?: 'simulated' | 'info' | 'neutral';
  children: ReactNode;
}

const TONES: Record<NonNullable<BadgeProps['tone']>, string> = {
  simulated: 'bg-simulated-soft text-text border-simulated',
  info: 'bg-info-soft text-text border-info',
  neutral: 'bg-surface-sunken text-text-muted border-border',
};

export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-pill border px-space-2 py-space-1 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}
