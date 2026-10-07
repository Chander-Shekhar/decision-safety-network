import type { ReactNode } from 'react';

export interface ActionBarProps {
  children: ReactNode;
}

/** Children are rendered in DOM order; place the primary action first. */
export function ActionBar({ children }: ActionBarProps) {
  return <div className="flex flex-wrap items-center gap-space-3">{children}</div>;
}
