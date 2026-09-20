import { getApp, getApps, initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
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
  sessionToken: string;
  replacementUsed: boolean;
}

export interface AdditionalPrayerCardsResult {
  cards: FirebasePrayerCard[];
  drawDate: string;
}

export interface PrayerCardReplacementResult {
  card: FirebasePrayerCard;
}

export interface PrayerSessionRequest {
  clientId: string;
  sessionToken?: string;
}

export interface SessionCallableRequest {
  sessionToken: string;
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
const appCheckSiteKey = envValue(import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY);

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
      // App Check is deliberately optional while the reCAPTCHA Enterprise key
      // is being registered. Once the key is set, callable requests include an
      // App Check token automatically and the backend can enforce it.
      if (appCheckSiteKey) {
        initializeAppCheck(app, {
          provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
          isTokenAutoRefreshEnabled: true,
        });
      }
      return {
        functions: getFunctions(app, envValue(import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION) ?? 'asia-northeast3'),
      };
    })()
  : null;

export async function startPrayerSession(request: PrayerSessionRequest): Promise<DailyPrayerCardsResult> {
  if (!firebaseServices) throw new Error('Firebase 공개 설정이 누락되었습니다.');
  const startSession = httpsCallable<PrayerSessionRequest, DailyPrayerCardsResult>(
    firebaseServices.functions,
    'startPrayerSession',
  );
  return (await startSession(request)).data;
}

/** Returns the fixed additional three-card round for the current prayer date. */
export async function getAdditionalPrayerCards(sessionToken: string): Promise<AdditionalPrayerCardsResult> {
  if (!firebaseServices) throw new Error('Firebase 공개 설정이 누락되었습니다.');
  const getCards = httpsCallable<SessionCallableRequest, AdditionalPrayerCardsResult>(
    firebaseServices.functions,
    'getAdditionalPrayerCards',
  );
  return (await getCards({ sessionToken })).data;
}

/**
 * Exchanges one of today's three cards for its server-selected alternative.
 * The browser never receives the full private card collection.
 */
export async function replaceDailyPrayerCard(
  cardId: string,
  sessionToken: string,
): Promise<PrayerCardReplacementResult> {
  if (!firebaseServices) throw new Error('Firebase 공개 설정이 누락되었습니다.');
  const replaceCard = httpsCallable<{ cardId: string; sessionToken: string }, PrayerCardReplacementResult>(
    firebaseServices.functions,
    'replaceDailyPrayerCard',
  );
  return (await replaceCard({ cardId, sessionToken })).data;
}
