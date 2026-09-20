import type { PrayerCard } from '../types';

export const CARDS_PER_ROUND = 3;

/**
 * Prayer card content must only arrive from the Firebase Function.
 * Keeping the normalizer here makes the client defensive without embedding
 * any prayer data into the GitHub Pages bundle.
 */
export function normalizePrayerCards(value: unknown): PrayerCard[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const card = item as Partial<PrayerCard> & {
      verse_reference?: unknown;
      verse_text?: unknown;
    };
    if (
      typeof card.id !== 'string' ||
      typeof card.name !== 'string' ||
      !Array.isArray(card.prayers) ||
      !card.prayers.every((prayer) => typeof prayer === 'string')
    ) {
      return [];
    }

    return [{
      id: card.id,
      name: card.name,
      cell: typeof card.cell === 'string' ? card.cell : undefined,
      verseReference:
        typeof card.verseReference === 'string'
          ? card.verseReference
          : typeof card.verse_reference === 'string'
            ? card.verse_reference
            : undefined,
      verseText:
        typeof card.verseText === 'string'
          ? card.verseText
          : typeof card.verse_text === 'string'
            ? card.verse_text
            : undefined,
      prayers: card.prayers,
    }];
  });
}
