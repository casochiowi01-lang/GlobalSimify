import { describe, expect, it } from 'vitest';
import { describeDevice } from './device';

describe('describeDevice', () => {
  it('recognises iPhones', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15';
    expect(describeDevice(ua)).toEqual({ os: 'ios', device: 'your iPhone' });
  });

  it('reads the Android model when the user agent includes one', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007) AppleWebKit/537.36';
    expect(describeDevice(ua)).toEqual({ os: 'android', device: 'SM-S918B' });
  });

  it('falls back to a generic Android name without a model', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36';
    expect(describeDevice(ua)).toEqual({
      os: 'android',
      device: 'your Android phone',
    });
  });

  it('treats desktops and unknown agents as other', () => {
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)').os).toBe(
      'other',
    );
    expect(describeDevice('')).toEqual({ os: 'other', device: 'your device' });
  });
});
