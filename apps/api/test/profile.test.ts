import { describe, expect, it } from 'vitest';
import { toWhatsAppNumber } from '../../../packages/contracts/src/profile.js';

describe('toWhatsAppNumber', () => {
  it('prefixes a 10-digit number with the India code and strips formatting', () => {
    expect(toWhatsAppNumber('98765 43210')).toBe('919876543210');
    expect(toWhatsAppNumber('(987) 654-3210')).toBe('919876543210');
  });

  it('keeps an international number as digits only', () => {
    expect(toWhatsAppNumber('+91 98765 43210')).toBe('919876543210');
    expect(toWhatsAppNumber('+1 415 555 0100')).toBe('14155550100');
  });

  it('drops a leading trunk zero on non-10-digit numbers', () => {
    expect(toWhatsAppNumber('0044 20 7946 0958')).toBe('442079460958');
  });

  it('returns null for missing or implausible numbers', () => {
    expect(toWhatsAppNumber(undefined)).toBeNull();
    expect(toWhatsAppNumber('')).toBeNull();
    expect(toWhatsAppNumber('12345')).toBeNull();
    expect(toWhatsAppNumber('1'.repeat(16))).toBeNull();
  });
});
