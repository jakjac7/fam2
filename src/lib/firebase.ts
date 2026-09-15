import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

export interface FirebasePrayerCard {
  id: string;
  name: string;
  cell?: string;
  verseReference?: string;
  verseText?: string;
  prayers: string[];
}

export interface DailyPrayerCardsResult {
  cards: FirebasePrayerCard[];
  drawDate: string;
}

export interface PrayerCardReplacementResult {
  card: FirebasePrayerCard;
}

function envValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

const apiKey = envValue(import.meta.env.VITE_FIREBASE_API_KEY);
const authDomain = envValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);
const projectId = envValue(import.meta.env.VITE_FIREBASE_PROJECT_ID);
const storageBucket = envValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET);
const messagingSenderId = envValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID);
const appId = envValue(import.meta.env.VITE_FIREBASE_APP_ID);

export const firebaseConfig =
  apiKey && authDomain && projectId && storageBucket && messagingSenderId && appId
    ? { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId }
    : null;

function getFirebaseApp() {
  if (!firebaseConfig) throw new Error('Firebase 공개 설정이 누락되었습니다.');
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

export const firebaseServices = firebaseConfig
  ? (() => {
      const app = getFirebaseApp();
      return {
        functions: getFunctions(app, envValue(import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION) ?? 'asia-northeast3'),
      };
    })()
  : null;

export async function getDailyPrayerCards(): Promise<DailyPrayerCardsResult> {
  if (!firebaseServices) throw new Error('Firebase 공개 설정이 누락되었습니다.');
  const getCards = httpsCallable<void, DailyPrayerCardsResult>(firebaseServices.functions, 'getDailyPrayerCards');
  return (await getCards()).data;
}

/**
 * Exchanges one of today's three cards for its server-selected alternative.
 * The browser never receives the full private card collection.
 */
export async function replaceDailyPrayerCard(cardId: string): Promise<PrayerCardReplacementResult> {
  if (!firebaseServices) throw new Error('Firebase 공개 설정이 누락되었습니다.');
  const replaceCard = httpsCallable<{ cardId: string }, PrayerCardReplacementResult>(
    firebaseServices.functions,
    'replaceDailyPrayerCard',
  );
  return (await replaceCard({ cardId })).data;
}
