import { describe, expect, it } from 'vitest';
import {
  resolveOfficialContact,
  toDialable,
  type OfficialContactLookup,
  type OfficialContactRaw,
} from '../src/official-contact.js';
import { DEMO_BANK_REGISTRY } from '../src/demo-bank-registry.js';

/** A fixed-return lookup double; `throws` makes it reject so we can assert the degrade-to-null path. */
function fakeLookup(raw: OfficialContactRaw | { throws: true }): OfficialContactLookup {
  return {
    async findNumber() {
      if ('throws' in raw) throw new Error('boom');
      return raw;
    },
  };
}

describe('toDialable', () => {
  it('keeps digits and an optional leading +, dropping spaces and punctuation', () => {
    expect(toDialable('+91 1800-123-123')).toBe('+911800123123');
    expect(toDialable('(022) 2719 0000')).toBe('02227190000');
  });

  it('permits short helpline codes but rejects implausibly short/long or non-string input', () => {
    expect(toDialable('1930')).toBe('1930');
    expect(toDialable('12')).toBeNull();
    expect(toDialable('1'.repeat(16))).toBeNull();
    expect(toDialable(null)).toBeNull();
    expect(toDialable(undefined)).toBeNull();
    expect(toDialable('')).toBeNull();
  });
});

describe('resolveOfficialContact', () => {
  it('resolves Demo Bank from the curated registry, never the live lookup', async () => {
    // Even if the lookup would return something else, Demo Bank is deterministic.
    const result = await resolveOfficialContact(fakeLookup({ organisation: 'Hijacked', phoneNumber: '+910000000000' }), 'Demo Bank fraud team');
    expect(result).toEqual({ organisation: 'Demo Bank', phoneNumber: DEMO_BANK_REGISTRY.contactNumber, source: 'demo-registry' });
  });

  it('returns a sanitized web-search number for a real organisation', async () => {
    const result = await resolveOfficialContact(fakeLookup({ organisation: 'Reserve Bank', phoneNumber: '1800 266 0000' }), 'Officer from the Reserve Bank');
    expect(result).toEqual({ organisation: 'Reserve Bank', phoneNumber: '18002660000', source: 'web-search' });
  });

  it('reports no number (hiding the action) when the lookup finds none', async () => {
    const result = await resolveOfficialContact(fakeLookup({ organisation: 'Some Office', phoneNumber: null }), 'man from some office');
    expect(result).toEqual({ organisation: 'Some Office', phoneNumber: null, source: 'web-search' });
  });

  it('degrades a lookup error to no number rather than throwing', async () => {
    const result = await resolveOfficialContact(fakeLookup({ throws: true }), 'someone from somewhere');
    expect(result).toEqual({ organisation: null, phoneNumber: null, source: 'web-search' });
  });

  it('reports no number for an empty claimed identity, without calling the lookup', async () => {
    let called = false;
    const lookup: OfficialContactLookup = {
      async findNumber() {
        called = true;
        return { organisation: null, phoneNumber: null };
      },
    };
    const result = await resolveOfficialContact(lookup, '   ');
    expect(result.phoneNumber).toBeNull();
    expect(called).toBe(false);
  });

  it('drops a garbled model number to null', async () => {
    const result = await resolveOfficialContact(fakeLookup({ organisation: 'Bank', phoneNumber: 'call us!' }), 'bank person');
    expect(result.phoneNumber).toBeNull();
  });
});
