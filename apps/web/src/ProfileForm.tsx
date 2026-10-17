import { useId, useState } from 'react';
import { PROFILE_NAME_MAX, type UserProfile } from '../../../packages/contracts/src/profile';
import { Button, Card } from './ui';
import { Field } from './ui/Field';

export interface ProfileFormProps {
  initial?: UserProfile;
  /** Short line under the title, e.g. why the number matters for this role. */
  hint: string;
  saved?: boolean;
  onSave: (profile: UserProfile) => void;
}

const INPUT_CLASS =
  'rounded-md border border-border bg-surface px-space-3 py-space-2 text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';

/** "Your details": the user's own display name + mobile (owner in Settings, ally on their pairing screen). */
export function ProfileForm({ initial, hint, saved = false, onSave }: ProfileFormProps): React.JSX.Element {
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '');
  const [mobile, setMobile] = useState(initial?.mobile ?? '');
  const nameId = useId();
  const mobileId = useId();

  return (
    <Card title="Your details">
      <p className="text-sm text-text-muted">{hint}</p>
      <Field label="Your name" htmlFor={nameId}>
        <input
          id={nameId}
          type="text"
          className={INPUT_CLASS}
          value={displayName}
          maxLength={PROFILE_NAME_MAX}
          autoComplete="name"
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </Field>
      <Field label="Your mobile number" htmlFor={mobileId} hint="Used to open WhatsApp straight to you. Include the country code if outside India.">
        <input
          id={mobileId}
          type="tel"
          className={INPUT_CLASS}
          value={mobile}
          autoComplete="tel"
          onChange={(e) => setMobile(e.target.value)}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-space-3">
        <Button variant="secondary" onClick={() => onSave({ displayName: displayName.trim(), mobile: mobile.trim() })}>
          Save my details
        </Button>
        {saved && (
          <span role="status" className="text-sm text-safe">
            Saved.
          </span>
        )}
      </div>
    </Card>
  );
}
