import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible name for the navigation drawer. */
  title: string;
  children: ReactNode;
}

/**
 * A left slide-in navigation drawer built on Radix Dialog, so it inherits a
 * focus trap, Esc-to-close, and an accessible title. Sized for the mobile
 * shell: a narrow panel over a dimmed backdrop. The drawer is constrained to
 * the shell's own column width on wide screens via the backdrop that the shell
 * centers around.
 */
export function Drawer({ open, onOpenChange, title, children }: DrawerProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-text/40" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80%] flex-col gap-space-2 border-r border-border bg-surface-raised p-space-4 text-text shadow-md focus:outline-none"
        >
          <div className="flex items-center justify-between">
            <RadixDialog.Title className="text-lg font-semibold tracking-tight">{title}</RadixDialog.Title>
            <RadixDialog.Close
              aria-label="Close menu"
              className="rounded-md px-space-2 py-space-1 text-text-muted hover:bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              ✕
            </RadixDialog.Close>
          </div>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
