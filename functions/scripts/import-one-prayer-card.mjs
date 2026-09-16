import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID;
const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const rawCard = process.env.PRAYER_CARD_IMPORT_JSON;

if (!projectId || !credentialPath) {
  throw new Error('Firebase deployment credentials are required.');
}

if (!rawCard) {
  throw new Error('PRAYER_CARD_IMPORT_JSON is required.');
}

let parsedCard;
try {
  parsedCard = JSON.parse(rawCard);
} catch {
  throw new Error('PRAYER_CARD_IMPORT_JSON must be valid JSON.');
}

const cleanText = (value, maximumLength) => (
  typeof value === 'string' && value.trim() && value.trim().length <= maximumLength
    ? value.trim()
    : null
);

const name = cleanText(parsedCard?.name, 80);
const cell = cleanText(parsedCard?.cell, 80);
const prayers = Array.isArray(parsedCard?.prayers)
  ? parsedCard.prayers.map((prayer) => cleanText(prayer, 500)).filter(Boolean)
  : [];

// This is deliberately a one-card importer. Keep the ID fixed so the
// workflow cannot be repurposed to enumerate or modify the card collection.
if (parsedCard?.id !== 'leader-024' || !name || !cell || prayers.length === 0 || prayers.length > 5) {
  throw new Error('The private card payload has an invalid shape.');
}

if (getApps().length === 0) {
  initializeApp({ credential: applicationDefault(), projectId });
}

await getFirestore()
  .collection('prayerCards')
  .doc('leader-024')
  .set({
    id: 'leader-024',
    name,
    cell,
    prayers,
    active: true,
  }, { merge: true });

console.log('Imported one private prayer card. No card content was logged.');
