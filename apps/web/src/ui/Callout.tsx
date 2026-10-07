import type { ReactNode } from 'react';

export interface CalloutProps {
  kind?: 'info' | 'caution' | 'error';
  role?: string;
  children: ReactNode;
}

const KINDS: Record<NonNullable<CalloutProps['kind']>, string> = {
  info: 'bg-info-soft border-info',
  caution: 'bg-pause-soft border-pause',
  error: 'bg-pause-soft border-pause border-2',
};

const LABELS: Record<NonNullable<CalloutProps['kind']>, string> = {
  info: 'Note',
  caution: 'Caution',
  error: 'Error',
};

export function Callout({ kind = 'info', role, children }: CalloutProps) {
  return (
    <div role={role} className={`rounded-md border-l-4 p-space-3 text-text ${KINDS[kind]}`}>
      <span className="sr-only">{LABELS[kind]}: </span>
      {children}
    </div>
  );
}
