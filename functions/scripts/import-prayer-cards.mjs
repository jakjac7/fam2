import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const functionsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.resolve(functionsRoot, '..');
const argumentsAfterScript = process.argv.slice(2);
const dryRun = argumentsAfterScript.includes('--dry-run');
const inputPath = argumentsAfterScript.find((argument) => argument !== '--dry-run')
  ?? path.join(projectRoot, 'PrayerCards.md');
const projectId = process.env.FIREBASE_PROJECT_ID;

const markdown = await readFile(inputPath, 'utf8');
const [cardSection] = markdown.split(/^#\s+웹 입력용 TypeScript\s*$/m);
const headings = [...cardSection.matchAll(/^##\s+(\d+)\.\s+(.+?)\s*$/gm)];
const cards = headings.map((heading, index) => {
  const headingText = heading[2].trim();
  const identity = headingText.match(/^(.*?)\s+\((.+)\)$/);
  const start = (heading.index ?? 0) + heading[0].length;
  const end = headings[index + 1]?.index ?? cardSection.length;
  const prayers = cardSection.slice(start, end)
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*\d+\.\s+(.+)$/)?.[1]?.trim())
    .filter(Boolean);

  return {
    id: `leader-${heading[1].padStart(3, '0')}`,
    name: identity?.[1]?.trim() ?? headingText,
    cell: identity?.[2]?.trim() ?? null,
    prayers,
    active: true,
  };
}).filter((card) => card.prayers.length > 0);

if (cards.length < 3) {
  throw new Error('The source file must contain at least three valid prayer cards.');
}

if (dryRun) {
  console.log(`Validated ${cards.length} prayer cards. No card content was logged.`);
  process.exit(0);
}

if (!projectId || !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error('FIREBASE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS must be set only in this local shell.');
}

const { applicationDefault, getApps, initializeApp } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');

if (getApps().length === 0) {
  initializeApp({ credential: applicationDefault(), projectId });
}

const db = getFirestore();
const batch = db.batch();
for (const card of cards) {
  batch.set(db.collection('prayerCards').doc(card.id), card, { merge: true });
}
await batch.commit();

console.log(`Imported ${cards.length} prayer cards. No card content was logged.`);
