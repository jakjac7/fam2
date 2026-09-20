import { useCallback, useEffect, useState } from 'react';
import { CARDS_PER_ROUND, normalizePrayerCards } from '../data/prayerCards';
import type { PrayerCard } from '../types';
import { firebaseServices, startPrayerSession } from '../lib/firebase';

export type PrayerAccessState =
  | { status: 'configuration-needed' }
  | { status: 'loading' }
  | {
      status: 'ready';
      cards: PrayerCard[];
      drawDate: string;
      sessionToken: string;
      replacementUsed: boolean;
    }
  | { status: 'error'; message: string };

const CLIENT_ID_STORAGE_KEY = 'fam2-prayer-client-id-v1';
const SESSION_STORAGE_KEY = 'fam2-prayer-session-v1';

interface StoredSession {
  token: string;
  drawDate: string;
}

function createOpaqueId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replaceAll('-', '');
  }
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function clientId(): string {
  const existing = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (existing && /^[a-f0-9]{32}$/i.test(existing)) return existing;

  const created = createOpaqueId();
  localStorage.setItem(CLIENT_ID_STORAGE_KEY, created);
  return created;
}

function readSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredSession>;
    return typeof value.token === 'string' && /^[A-Za-z0-9_-]{32,}$/.test(value.token)
      && typeof value.drawDate === 'string'
      ? { token: value.token, drawDate: value.drawDate }
      : null;
  } catch {
    return null;
  }
}

function saveSession(token: string, drawDate: string) {
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token, drawDate }));
}

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
      const existingSession = readSession();
      const result = await startPrayerSession({
        clientId: clientId(),
        sessionToken: existingSession?.token,
      });
      const cards = normalizePrayerCards(result.cards);
      if (cards.length !== CARDS_PER_ROUND) {
        throw new Error('오늘의 기도카드를 준비하지 못했습니다. 잠시 후 다시 시도해주세요.');
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(result.drawDate)) {
        throw new Error('오늘의 날짜 정보를 확인하지 못했습니다.');
      }
      if (!/^[A-Za-z0-9_-]{32,}$/.test(result.sessionToken)) {
        throw new Error('안전한 기도 세션을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
      saveSession(result.sessionToken, result.drawDate);
      setState({
        status: 'ready',
        cards,
        drawDate: result.drawDate,
        sessionToken: result.sessionToken,
        replacementUsed: result.replacementUsed === true,
      });
    } catch (error) {
      setState({ status: 'error', message: displayError(error) });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, load };
}
