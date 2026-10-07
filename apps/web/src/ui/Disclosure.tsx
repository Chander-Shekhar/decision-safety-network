import * as Collapsible from '@radix-ui/react-collapsible';
import type { ReactNode } from 'react';

export interface DisclosureProps {
  summary: ReactNode;
  children: ReactNode;
}

export function Disclosure({ summary, children }: DisclosureProps) {
  return (
    <Collapsible.Root className="rounded-md border border-border bg-surface-raised">
      <Collapsible.Trigger className="w-full px-space-4 py-space-2 text-left text-sm font-medium text-text hover:bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        {summary}
      </Collapsible.Trigger>
      <Collapsible.Content className="border-t border-border p-space-4 text-text">{children}</Collapsible.Content>
    </Collapsible.Root>
  );
}
