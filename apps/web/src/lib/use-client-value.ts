'use client';

import { useSyncExternalStore } from 'react';

const subscribeNever = () => () => {};

/**
 * Read a browser-only value (user agent, storage, feature support) without a
 * mount effect. The server and hydration render `serverValue`; the client then
 * reads `read()`. `read` must return a stable primitive for unchanged input.
 */
export function useClientValue<T extends string | number | boolean>(
  read: () => T,
  serverValue: T,
): T {
  return useSyncExternalStore(subscribeNever, read, () => serverValue);
}
