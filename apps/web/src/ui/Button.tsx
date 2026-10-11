import type { ReactNode } from 'react';

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'pause' | 'cancel' | 'ghost' | 'link';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
  children: ReactNode;
}

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-primary text-primary-contrast border-transparent hover:opacity-90',
  secondary: 'bg-surface-raised text-text border-border hover:bg-surface-sunken',
  pause: 'bg-pause text-primary-contrast border-transparent font-semibold hover:opacity-90',
  cancel: 'bg-safe-soft text-text border-safe hover:opacity-90',
  ghost: 'bg-transparent text-text border-transparent hover:bg-surface-sunken',
  link: 'bg-transparent text-primary border-transparent underline underline-offset-2 hover:opacity-80 px-0',
};

const SIZES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-space-3 py-space-1 text-sm',
  md: 'px-space-4 py-space-2 text-base',
  lg: 'px-space-5 py-space-3 text-base font-semibold shadow-sm w-full sm:w-auto',
};

export function Button({ variant = 'primary', size = 'md', disabled, type = 'button', onClick, children }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-space-2 rounded-md border font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]}`}
    >
      {children}
    </button>
  );
}
