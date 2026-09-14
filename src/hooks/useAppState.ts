import { useState, useEffect } from 'react';
import { AppState, ScreenType } from '../types';
import { PRAYER_CARDS } from '../data/prayerCards';
import { drawUniqueCardIds } from '../domain/drawCards';

const SESSION_KEY = 'prayer_app_state';

const initialState: AppState = {
  screen: 'start',
  consented: false,
  selectedCardIds: [],
  currentCardIndex: 0,
  visitedCards: [false, false, false],
};

export function useAppState() {
  const [state, setState] = useState<AppState>(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      // Ignore sessionStorage errors
    }
    return initialState;
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
    } catch (e) {
      // Ignore
    }
  }, [state]);

  const updateState = (updates: Partial<AppState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const handleConsent = () => {
    // Only draw cards if we haven't already in this session
    if (state.selectedCardIds.length === 0) {
      try {
        const ids = drawUniqueCardIds(PRAYER_CARDS, 3);
        updateState({
          consented: true,
          screen: 'prayer',
          selectedCardIds: ids,
          visitedCards: [true, false, false] // Mark first as visited
        });
      } catch (error) {
        console.error("Failed to draw cards");
      }
    } else {
      updateState({
        consented: true,
        screen: 'prayer',
        visitedCards: [true, ...state.visitedCards.slice(1)]
      });
    }
  };

  const navigateToCard = (index: number) => {
    if (index >= 0 && index < 3) {
      const newVisited = [...state.visitedCards];
      newVisited[index] = true;
      updateState({
        currentCardIndex: index,
        visitedCards: newVisited
      });
    }
  };

  const nextCard = () => {
    if (state.currentCardIndex < 2) {
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

      updateState({
        selectedCardIds: updatedCardIds,
        visitedCards: updatedVisited
      });
    } catch (e) {
      alert("교체할 수 있는 카드가 부족합니다.");
    }
  };

  const completePrayer = () => {
    if (state.visitedCards.every(Boolean)) {
      updateState({ screen: 'complete' });
    }
  };

  const prayMore = () => {
    try {
      // Try to draw 3 new cards excluding the current ones
      const newIds = drawUniqueCardIds(PRAYER_CARDS, 3, state.selectedCardIds);
      updateState({
        screen: 'prayer',
        selectedCardIds: newIds,
        currentCardIndex: 0,
        visitedCards: [true, false, false]
      });
    } catch (e) {
      // If not enough cards left, just draw any 3
      const fallbackIds = drawUniqueCardIds(PRAYER_CARDS, 3, []);
      updateState({
        screen: 'prayer',
        selectedCardIds: fallbackIds,
        currentCardIndex: 0,
        visitedCards: [true, false, false]
      });
    }
  };

  return {
    state,
    updateState,
    handleConsent,
    navigateToCard,
    nextCard,
    replaceCurrentCard,
    completePrayer,
    prayMore
  };
}
