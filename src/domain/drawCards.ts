import { PrayerCard } from '../types';

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
    // Generate a random index using Web Crypto API
    let randomIndex = 0;
    if (window.crypto && window.crypto.getRandomValues) {
      const randomBuffer = new Uint32Array(1);
      window.crypto.getRandomValues(randomBuffer);
      randomIndex = randomBuffer[0] % availableCandidates.length;
    } else {
      // Fallback for older browsers
      randomIndex = Math.floor(Math.random() * availableCandidates.length);
    }

    selectedIds.push(availableCandidates[randomIndex].id);
    
    // Remove selected candidate to prevent duplicates
    availableCandidates.splice(randomIndex, 1);
  }

  return selectedIds;
}
