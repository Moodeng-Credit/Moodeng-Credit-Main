// src/utils/stableKeys.ts
import { useMemo } from 'react';

import crypto from 'crypto';

/**
 * Hook that generates stable keys for an array of items using a key extractor or UUIDs
 * @param items Array of items needing stable keys
 * @param keyExtractor Optional function that extracts a stable key from an item (without index).
 *                     If not provided, UUIDs will be generated for each item.
 * @returns Array of objects with stable id and original content
 */
export function useStableKeys<T>(items: T[], keyExtractor?: (item: T) => string) {
   return useMemo(
      () =>
         items.map((item) => ({
            id: keyExtractor ? keyExtractor(item) : crypto.randomUUID(),
            content: item
         })),
      [items, keyExtractor]
   );
}
