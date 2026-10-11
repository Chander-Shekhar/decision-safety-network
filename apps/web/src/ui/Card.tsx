import type { ReactNode } from 'react';

export interface CardProps {
  title?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function Card({ title, footer, children }: CardProps) {
  return (
    <section className="rounded-lg border border-border bg-surface-raised shadow-sm">
      {title && <h2 className="px-space-5 pt-space-5 text-xl font-semibold tracking-tight text-text">{title}</h2>}
      <div className="flex flex-col gap-space-4 p-space-5 text-text">{children}</div>
      {footer && <div className="border-t border-border bg-surface-sunken px-space-4 py-space-3">{footer}</div>}
    </section>
  );
}
