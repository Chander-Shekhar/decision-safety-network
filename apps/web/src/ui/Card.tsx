import type { ReactNode } from 'react';

export interface CardProps {
  title?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function Card({ title, footer, children }: CardProps) {
  return (
    <section className="rounded-lg border border-border bg-surface-raised shadow-sm">
      {title && <h2 className="border-b border-border px-space-4 py-space-3 text-lg font-semibold text-text">{title}</h2>}
      <div className="flex flex-col gap-space-3 p-space-4 text-text">{children}</div>
      {footer && <div className="border-t border-border bg-surface-sunken px-space-4 py-space-3">{footer}</div>}
    </section>
  );
}
