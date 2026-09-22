import { createHash } from 'node:crypto';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId || !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error('FIREBASE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS are required.');
}

if (getApps().length === 0) {
  initializeApp({ credential: applicationDefault(), projectId });
}

const db = getFirestore();

function stableLeaderId(name, cell) {
  const safeName = typeof name === 'string' ? name.normalize('NFC').trim() : '';
  const safeCell = typeof cell === 'string' ? cell.normalize('NFC').trim() : '';
  return `leader-${createHash('sha256').update(`${safeName}\u0000${safeCell}`).digest('hex').slice(0, 24)}`;
}

function isActiveCard(snapshot) {
  return snapshot.get('active') === true || snapshot.get('active') === 'true';
}

function mapCardIds(value, idMap) {
  if (!Array.isArray(value)) return value;
  return value.map((id) => (typeof id === 'string' ? idMap.get(id) ?? id : id));
}

const cardSnapshots = await db.collection('prayerCards').get();
const activeCards = cardSnapshots.docs.filter(isActiveCard);
const idMap = new Map();
const writes = [];

for (const card of activeCards) {
  const data = card.data();
  const stableId = stableLeaderId(data.name, data.cell);
  if (!data.name || stableId === card.id) continue;

  idMap.set(card.id, stableId);
  writes.push({ type: 'set', ref: db.collection('prayerCards').doc(stableId), data: {
    ...data,
    active: true,
    migratedAt: FieldValue.serverTimestamp(),
  } });
  writes.push({ type: 'update', ref: card.ref, data: {
    active: false,
    supersededBy: stableId,
    migratedAt: FieldValue.serverTimestamp(),
  } });
}

const drawSnapshots = await db.collection('dailyPrayerDraws').get();
let rewrittenDraws = 0;
for (const draw of drawSnapshots.docs) {
  const data = draw.data();
  const replacementFields = ['cardIds', 'additionalCardIds', 'replacementCardIds', 'replacementUsedCardIds'];
  const migratedFields = Object.fromEntries(
    replacementFields
      .filter((field) => Array.isArray(data[field]))
      .map((field) => [field, mapCardIds(data[field], idMap)]),
  );
  const changed = Object.entries(migratedFields)
    .some(([field, value]) => JSON.stringify(value) !== JSON.stringify(data[field]));
  if (!changed) continue;

  rewrittenDraws += 1;
  writes.push({ type: 'set', ref: draw.ref, data: {
    ...migratedFields,
    idMigrationVersion: 1,
    idMigratedAt: FieldValue.serverTimestamp(),
  } });
}

for (let index = 0; index < writes.length; index += 450) {
  const batch = db.batch();
  for (const write of writes.slice(index, index + 450)) {
    if (write.type === 'set') batch.set(write.ref, write.data, { merge: true });
    else batch.update(write.ref, write.data);
  }
  await batch.commit();
}

console.log(`Active cards: ${activeCards.length}`);
console.log(`Migrated card identifiers: ${idMap.size}`);
console.log(`Rewritten draw records: ${rewrittenDraws}`);
console.log('No prayer-card names or contents were logged.');
