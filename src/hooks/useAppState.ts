import { useEffect, useState } from 'react';
import type { AppState, ScreenType } from '../types';
import {
  CARDS_PER_ROUND,
  PRAYER_CARD_BY_ID,
  PRAYER_CARDS,
} from '../data/prayerCards';
import { drawUniqueCardIds } from '../domain/drawCards';

const SESSION_KEY = 'prayer_app_state';
const CARD_COUNT = CARDS_PER_ROUND;
const SCREENS: ScreenType[] = ['start', 'consent', 'prayer', 'complete'];

function createInitialState(): AppState {
  return {
    screen: 'start',
    consented: false,
    selectedCardIds: [],
    currentCardIndex: 0,
    visitedCards: Array(CARD_COUNT).fill(false),
  };
}

function hasValidStoredState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false;

  const state = value as Partial<AppState>;
  const hasCards =
    Array.isArray(state.selectedCardIds) &&
    state.selectedCardIds.length === CARD_COUNT &&
    new Set(state.selectedCardIds).size === CARD_COUNT &&
    state.selectedCardIds.every((id) => typeof id === 'string' && PRAYER_CARD_BY_ID.has(id));
  const hasVisitedCards =
    Array.isArray(state.visitedCards) &&
    state.visitedCards.length === CARD_COUNT &&
    state.visitedCards.every((visited) => typeof visited === 'boolean');
  const hasEmptySelection =
    Array.isArray(state.selectedCardIds) && state.selectedCardIds.length === 0;
  const validScreen =
    typeof state.screen === 'string' && SCREENS.includes(state.screen as ScreenType);

  if (!validScreen || typeof state.consented !== 'boolean' || !Number.isInteger(state.currentCardIndex)) {
    return false;
  }

  if (state.screen === 'start' || state.screen === 'consent') {
    return (
      !state.consented &&
      hasEmptySelection &&
      hasVisitedCards &&
      state.currentCardIndex === 0 &&
      (state.screen !== 'consent' || PRAYER_CARDS.length >= CARD_COUNT)
    );
  }

  return (
    state.consented &&
    hasCards &&
    hasVisitedCards &&
    state.currentCardIndex >= 0 &&
    state.currentCardIndex < CARD_COUNT
  );
}

function restoreState(): AppState {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    const parsed = stored ? JSON.parse(stored) : null;
    return hasValidStoredState(parsed) ? parsed : createInitialState();
  } catch {
    return createInitialState();
  }
}

function createRound(excludedIds: string[] = []): string[] {
  return drawUniqueCardIds(PRAYER_CARDS, CARD_COUNT, excludedIds);
}

export function useAppState() {
  const [state, setState] = useState<AppState>(restoreState);

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
    } catch {
      // Session storage can be unavailable in private browsing contexts.
    }
  }, [state]);

  const beginConsent = () => {
    setState((current) => ({ ...current, screen: 'consent' }));
  };

  const handleConsent = () => {
    if (PRAYER_CARDS.length < CARD_COUNT) return;

    const ids = createRound();
    setState((current) => {
      // A second tap should preserve the first draw rather than replace it.
      if (current.selectedCardIds.length === CARD_COUNT) {
        return {
          ...current,
          consented: true,
          screen: 'prayer',
          visitedCards: [true, ...current.visitedCards.slice(1)],
        };
      }

      return {
        consented: true,
        screen: 'prayer',
        selectedCardIds: ids,
        currentCardIndex: 0,
        visitedCards: [true, ...Array(CARD_COUNT - 1).fill(false)],
      };
    });
  };

  const navigateToCard = (index: number) => {
    if (index >= 0 && index < CARD_COUNT) {
      setState((current) => ({
        ...current,
        currentCardIndex: index,
        visitedCards: current.visitedCards.map((visited, cardIndex) =>
          cardIndex === index ? true : visited,
        ),
      }));
    }
  };

  const nextCard = () => {
    if (state.currentCardIndex < CARD_COUNT - 1) {
      navigateToCard(state.currentCardIndex + 1);
    }
  };

  const replaceCurrentCard = () => {
    try {
      // Draw 1 new card, excluding all currently selected cards
      const newIds = drawUniqueCardIds(PRAYER_CARDS, 1, state.selectedCardIds);
      
      const updatedCardIds = [...state.selectedCardIds];
      updatedCardIds[state.currentCardIndex] = newIds[0];
      
      const updatedVisited = [...state.visitedCards];
      updatedVisited[state.currentCardIndex] = true; // Mark new as visited

      setState((current) => ({
        ...current,
        selectedCardIds: updatedCardIds,
        visitedCards: updatedVisited,
      }));
    } catch {
      alert("교체할 수 있는 카드가 부족합니다.");
    }
  };

  const completePrayer = () => {
    if (state.visitedCards.every(Boolean)) {
      setState((current) => ({ ...current, screen: 'complete' }));
    }
  };

  const prayMore = () => {
    try {
      // Try to draw 3 new cards excluding the current ones
      const newIds = drawUniqueCardIds(PRAYER_CARDS, 3, state.selectedCardIds);
      setState((current) => ({
        ...current,
        screen: 'prayer',
        selectedCardIds: newIds,
        currentCardIndex: 0,
        visitedCards: [true, ...Array(CARD_COUNT - 1).fill(false)],
      }));
    } catch {
      // If not enough cards left, just draw any 3
      const fallbackIds = createRound();
      setState((current) => ({
        ...current,
        screen: 'prayer',
        selectedCardIds: fallbackIds,
        currentCardIndex: 0,
        visitedCards: [true, ...Array(CARD_COUNT - 1).fill(false)],
      }));
    }
  };

  return {
    state,
    beginConsent,
    handleConsent,
    navigateToCard,
    nextCard,
    replaceCurrentCard,
    completePrayer,
    prayMore
  };
}
