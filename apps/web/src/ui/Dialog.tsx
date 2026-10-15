import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}

export function Dialog({ open, onOpenChange, title, children }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 bg-text opacity-40" />
        <RadixDialog.Content
          aria-describedby={undefined}
          // max-h + overflow-y-auto so a tall packet scrolls INSIDE the dialog: Radix locks
          // body scroll while the modal is open, so without this the content (and the close
          // button) overflow off-screen with no way to reach them — the app looks frozen.
          className="fixed left-1/2 top-1/2 flex max-h-[85vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto overscroll-contain rounded-lg border border-border bg-surface-raised p-space-5 text-text shadow-md"
        >
          <RadixDialog.Title className="sr-only">{title}</RadixDialog.Title>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
