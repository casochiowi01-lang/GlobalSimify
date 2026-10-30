export type DevicePlatform = 'ios' | 'android' | 'other';

/** Best-effort platform and display name from a user-agent string. */
export function describeDevice(userAgent: string): {
  os: DevicePlatform;
  device: string;
} {
  if (!userAgent) return { os: 'other', device: 'your device' };
  if (/iphone|ipad|ipod/i.test(userAgent)) {
    return { os: 'ios', device: 'your iPhone' };
  }
  if (/android/i.test(userAgent)) {
    const model = userAgent.match(/;\s?([^;)]+)\sBuild/i);
    return {
      os: 'android',
      device: model ? model[1].trim() : 'your Android phone',
    };
  }
  return { os: 'other', device: 'your phone' };
}
