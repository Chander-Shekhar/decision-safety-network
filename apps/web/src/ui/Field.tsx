import type { ReactNode } from 'react';

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, htmlFor, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-space-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-text">{label}</label>
      {children}
      {hint && <p className="text-sm text-text-muted">{hint}</p>}
      {error && <p role="alert" className="text-sm font-medium text-text">Error: {error}</p>}
    </div>
  );
}
