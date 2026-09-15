export type ScreenType = 'start' | 'consent' | 'prayer' | 'complete';

export interface PrayerCard {
  id: string;
  name: string;
  cell?: string;
  verseReference?: string;
  verseText?: string;
  prayers: string[];
}

export interface AppState {
  screen: ScreenType;
  consented: boolean;
  prayerName: string;
  selectedCardIds: string[];
  currentCardIndex: number;
  visitedCards: boolean[];
}
