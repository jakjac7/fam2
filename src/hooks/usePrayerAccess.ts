import { useCallback, useEffect, useState } from 'react';
import { CARDS_PER_ROUND, normalizePrayerCards } from '../data/prayerCards';
import type { PrayerCard } from '../types';
import { firebaseServices, getDailyPrayerCards } from '../lib/firebase';

export type PrayerAccessState =
  | { status: 'configuration-needed' }
  | { status: 'loading' }
  | { status: 'ready'; cards: PrayerCard[]; drawDate: string }
  | { status: 'error'; message: string };

function displayError(error: unknown): string {
  if (!(error instanceof Error)) return '오늘의 기도카드를 불러오지 못했습니다.';
  return error.message;
}

export function usePrayerAccess() {
  const [state, setState] = useState<PrayerAccessState>(() =>
    firebaseServices ? { status: 'loading' } : { status: 'configuration-needed' },
  );

  const load = useCallback(async () => {
    if (!firebaseServices) {
      setState({ status: 'configuration-needed' });
      return;
    }

    setState({ status: 'loading' });
    try {
      const result = await getDailyPrayerCards();
      const cards = normalizePrayerCards(result.cards);
      if (cards.length !== CARDS_PER_ROUND) {
        throw new Error('오늘의 기도카드를 준비하지 못했습니다. 잠시 후 다시 시도해주세요.');
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(result.drawDate)) {
        throw new Error('오늘의 날짜 정보를 확인하지 못했습니다.');
      }
      setState({ status: 'ready', cards, drawDate: result.drawDate });
    } catch (error) {
      setState({ status: 'error', message: displayError(error) });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, load };
}
