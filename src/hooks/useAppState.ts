import { useEffect, useMemo, useState } from 'react';
import type { AppState, PrayerCard, ScreenType } from '../types';
import { CARDS_PER_ROUND } from '../data/prayerCards';
import { drawUniqueCardIds } from '../domain/drawCards';

const SESSION_KEY_PREFIX = 'prayer_app_state';
const CARD_COUNT = CARDS_PER_ROUND;
const SCREENS: ScreenType[] = ['start', 'consent', 'prayer', 'complete'];

function createInitialState(): AppState {
  return {
    screen: 'start',
    consented: false,
    prayerName: '',
    selectedCardIds: [],
    currentCardIndex: 0,
    visitedCards: Array(CARD_COUNT).fill(false),
  };
}

function hasValidStoredState(
  value: unknown,
  cardIds: ReadonlySet<string>,
  cardCount: number,
): value is AppState {
  if (!value || typeof value !== 'object') return false;

  const state = value as Partial<AppState>;
  const selectedCardCount = state.selectedCardIds?.length ?? 0;
  const hasCards =
    Array.isArray(state.selectedCardIds) &&
    (selectedCardCount === CARD_COUNT || selectedCardCount === CARD_COUNT * 2) &&
    new Set(state.selectedCardIds).size === selectedCardCount &&
    state.selectedCardIds.every((id) => typeof id === 'string' && cardIds.has(id));
  const hasVisitedCards =
    Array.isArray(state.visitedCards) &&
    state.visitedCards.length === (hasCards ? selectedCardCount : CARD_COUNT) &&
    state.visitedCards.every((visited) => typeof visited === 'boolean');
  const hasEmptySelection =
    Array.isArray(state.selectedCardIds) && state.selectedCardIds.length === 0;
  const validScreen =
    typeof state.screen === 'string' && SCREENS.includes(state.screen as ScreenType);

  if (
    !validScreen ||
    typeof state.consented !== 'boolean' ||
    (state.prayerName !== undefined && typeof state.prayerName !== 'string') ||
    !Number.isInteger(state.currentCardIndex)
  ) {
    return false;
  }

  if (state.screen === 'start' || state.screen === 'consent') {
    return (
      !state.consented &&
      hasEmptySelection &&
      hasVisitedCards &&
      state.currentCardIndex === 0 &&
      (state.screen !== 'consent' || cardCount >= CARD_COUNT)
    );
  }

  return (
    state.consented &&
    hasCards &&
    hasVisitedCards &&
    state.currentCardIndex >= 0 &&
    state.currentCardIndex < selectedCardCount
  );
}

function restoreState(sessionKey: string, cardIds: ReadonlySet<string>, cardCount: number): AppState {
  try {
    const stored = sessionStorage.getItem(sessionKey);
    const parsed = stored ? JSON.parse(stored) : null;
    return hasValidStoredState(parsed, cardIds, cardCount) ? parsed : createInitialState();
  } catch {
    return createInitialState();
  }
}

function createRound(cards: PrayerCard[], excludedIds: string[] = []): string[] {
  return drawUniqueCardIds(cards, CARD_COUNT, excludedIds);
}

export function useAppState(cards: PrayerCard[], roundKey: string) {
  const cardIds = useMemo(() => new Set(cards.map((card) => card.id)), [cards]);
  const sessionKey = `${SESSION_KEY_PREFIX}:${roundKey}`;
  const [state, setState] = useState<AppState>(() => restoreState(sessionKey, cardIds, cards.length));

  useEffect(() => {
    try {
      sessionStorage.setItem(sessionKey, JSON.stringify(state));
    } catch {
      // Session storage can be unavailable in private browsing contexts.
    }
  }, [sessionKey, state]);

  const beginConsent = () => {
    setState((current) => ({ ...current, screen: 'consent' }));
  };

  const handleConsent = (prayerName: string) => {
    if (cards.length < CARD_COUNT) return;

    const normalizedName = prayerName.trim();
    if (!normalizedName) return;

    const ids = createRound(cards);
    setState((current) => {
      // A second tap should preserve the first draw rather than replace it.
      if (current.selectedCardIds.length === CARD_COUNT) {
        return {
          ...current,
          consented: true,
          prayerName: normalizedName,
          screen: 'prayer',
          visitedCards: [true, ...current.visitedCards.slice(1)],
        };
      }

      return {
        consented: true,
        prayerName: normalizedName,
        screen: 'prayer',
        selectedCardIds: ids,
        currentCardIndex: 0,
        visitedCards: [true, ...Array(CARD_COUNT - 1).fill(false)],
      };
    });
  };

  const navigateToCard = (index: number) => {
    if (index >= 0 && index < state.selectedCardIds.length) {
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
    if (state.currentCardIndex < state.selectedCardIds.length - 1) {
      navigateToCard(state.currentCardIndex + 1);
    }
  };

  const completePrayer = () => {
    if (state.visitedCards.every(Boolean)) {
      setState((current) => ({ ...current, screen: 'complete' }));
    }
  };

  const prayMore = () => {
    setState((current) => ({
      ...current,
      screen: 'prayer',
      currentCardIndex: 0,
      visitedCards: [true, ...Array(current.selectedCardIds.length - 1).fill(false)],
    }));
  };

  const addAdditionalCards = (additionalCardIds: string[]) => {
    if (
      additionalCardIds.length !== CARD_COUNT
      || new Set(additionalCardIds).size !== CARD_COUNT
    ) return;

    setState((current) => {
      if (
        current.selectedCardIds.length !== CARD_COUNT
        || additionalCardIds.some((cardId) => current.selectedCardIds.includes(cardId))
      ) return current;

      return {
        ...current,
        screen: 'prayer',
        selectedCardIds: [...current.selectedCardIds, ...additionalCardIds],
        currentCardIndex: CARD_COUNT,
        visitedCards: [...current.visitedCards, true, ...Array(CARD_COUNT - 1).fill(false)],
      };
    });
  };

  const replaceCurrentCard = (replacementId: string) => {
    setState((current) => {
      const { currentCardIndex } = current;
      if (current.selectedCardIds.includes(replacementId)) return current;

      return {
        ...current,
        selectedCardIds: current.selectedCardIds.map((cardId, index) =>
          index === currentCardIndex ? replacementId : cardId,
        ),
        visitedCards: current.visitedCards.map((visited, index) =>
          index === currentCardIndex ? true : visited,
        ),
      };
    });
  };

  return {
    state,
    beginConsent,
    handleConsent,
    navigateToCard,
    nextCard,
    completePrayer,
    prayMore,
    addAdditionalCards,
    replaceCurrentCard,
  };
}
