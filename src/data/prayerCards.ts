import prayerCardsMarkdown from '../../PrayerCards.md?raw';
import type { PrayerCard } from '../types';

export const CARDS_PER_ROUND = 3;

/**
 * Reads the actual card-display section of PrayerCards.md at build time.
 * The TypeScript reference section in that document is intentionally ignored.
 */
export function parsePrayerCards(markdown: string): PrayerCard[] {
  const [cardSection] = markdown.split(/^#\s+웹 입력용 TypeScript\s*$/m);
  const headingPattern = /^##\s+(\d+)\.\s+(.+?)\s*$/gm;
  const headings = [...cardSection.matchAll(headingPattern)];

  return headings.map((heading, index) => {
    const headingText = heading[2].trim();
    const identity = headingText.match(/^(.*?)\s+\((.+)\)$/);
    const start = (heading.index ?? 0) + heading[0].length;
    const end = headings[index + 1]?.index ?? cardSection.length;
    const body = cardSection.slice(start, end);
    const prayers = body
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*\d+\.\s+(.+)$/)?.[1]?.trim())
      .filter((item): item is string => Boolean(item));

    return {
      id: `leader-${heading[1].padStart(3, '0')}`,
      name: identity?.[1]?.trim() ?? headingText,
      cell: identity?.[2]?.trim(),
      prayers,
    } satisfies PrayerCard;
  }).filter((card) => card.prayers.length > 0);
}

export const PRAYER_CARDS = parsePrayerCards(prayerCardsMarkdown);

export const PRAYER_CARD_BY_ID = new Map(
  PRAYER_CARDS.map((card) => [card.id, card] as const),
);
