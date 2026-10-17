import type { Firestore } from 'firebase-admin/firestore';
import type { UserProfile } from '../../../packages/contracts/src/profile.js';

/** A user's own profile (owner or ally); `{}` until they add details. */
export async function getProfile(db: Firestore, uid: string): Promise<UserProfile> {
  const snap = await db.collection('profiles').doc(uid).get();
  if (!snap.exists) return {};
  const name = snap.get('displayName');
  const mobile = snap.get('mobile');
  return {
    ...(typeof name === 'string' && name ? { displayName: name } : {}),
    ...(typeof mobile === 'string' && mobile ? { mobile } : {}),
  };
}

/** Replaces the caller's own profile; blank fields are simply absent. */
export async function saveProfile(db: Firestore, uid: string, input: UserProfile): Promise<UserProfile> {
  const profile: UserProfile = {
    ...(input.displayName ? { displayName: input.displayName } : {}),
    ...(input.mobile ? { mobile: input.mobile } : {}),
  };
  await db.collection('profiles').doc(uid).set(profile);
  return profile;
}
