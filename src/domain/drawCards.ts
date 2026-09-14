import type { PrayerCard } from '../types';

function randomIndex(length: number): number {
  if (length <= 0) {
    throw new Error('Cannot choose from an empty list.');
  }

  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    return Math.floor(Math.random() * length);
  }

  // Reject the small upper range that would bias a modulo-based result.
  const range = 2 ** 32;
  const upperBound = range - (range % length);
  const buffer = new Uint32Array(1);

  do {
    cryptoApi.getRandomValues(buffer);
  } while (buffer[0] >= upperBound);

  return buffer[0] % length;
}

/**
 * Draws `count` unique cards from the list, avoiding any ids in `excludedIds`.
 * Uses Web Crypto API if available for better randomness.
 */
export function drawUniqueCardIds(
  cards: PrayerCard[],
  count: number,
  excludedIds: string[] = []
): string[] {
  const excludedSet = new Set(excludedIds);
  const candidates = cards.filter(card => !excludedSet.has(card.id));

  if (candidates.length < count) {
    throw new Error("Not enough candidate cards to draw from.");
  }

  const selectedIds: string[] = [];
  const availableCandidates = [...candidates];

  for (let i = 0; i < count; i++) {
    const index = randomIndex(availableCandidates.length);

    selectedIds.push(availableCandidates[index].id);
    
    // Remove selected candidate to prevent duplicates
    availableCandidates.splice(index, 1);
  }

  return selectedIds;
}
