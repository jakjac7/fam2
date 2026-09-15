import { randomInt } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

initializeApp();
setGlobalOptions({ region: 'asia-northeast3', maxInstances: 10 });

const db = getFirestore();
const CARDS_PER_ROUND = 3;
const KOREA_TIME_ZONE = 'Asia/Seoul';

function koreaCalendarDate() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: KOREA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function pickUniqueCards(cards, count) {
  const available = [...cards];
  for (let index = available.length - 1; index > 0; index -= 1) {
    const selectedIndex = randomInt(index + 1);
    [available[index], available[selectedIndex]] = [available[selectedIndex], available[index]];
  }
  return available.slice(0, count);
}

function asPrayerCard(snapshot) {
  const card = snapshot.data();
  const prayers = Array.isArray(card.prayers)
    ? card.prayers.filter((prayer) => typeof prayer === 'string')
    : typeof card.prayers === 'string'
      ? card.prayers.split(/\r?\n/).map((prayer) => prayer.trim()).filter(Boolean)
      : [];
  return {
    id: snapshot.id,
    name: card.name,
    cell: card.cell ?? undefined,
    verseReference: card.verseReference ?? undefined,
    verseText: card.verseText ?? undefined,
    prayers,
  };
}

function isActiveCard(card) {
  return card.get('active') === true || card.get('active') === 'true';
}

function isValidCardIdList(value) {
  return Array.isArray(value)
    && value.length === CARDS_PER_ROUND
    && value.every((cardId) => typeof cardId === 'string' && cardId);
}

/**
 * Returns the same three cards to every visitor during one Korea calendar day,
 * then safely creates a new random draw the next day. Firestore Rules deny all
 * browser reads; the function only exposes the three selected cards.
 */
export const getDailyPrayerCards = onCall({
  cors: [
    'https://fam2-prayer-cards.web.app',
    'https://fam2-prayer-cards.firebaseapp.com',
    'https://jakjac7.github.io',
  ],
}, async () => {
  const drawDate = koreaCalendarDate();
  const drawRef = db.collection('dailyPrayerDraws').doc(drawDate);
  const assignedCards = await db.runTransaction(async (transaction) => {
    const existingDraw = await transaction.get(drawRef);
    if (existingDraw.exists) {
      const cardIds = existingDraw.data().cardIds;
      if (isValidCardIdList(cardIds)) {
        const snapshots = await Promise.all(
          cardIds.map((cardId) => transaction.get(db.collection('prayerCards').doc(cardId))),
        );
        if (snapshots.every((snapshot) => snapshot.exists)) return snapshots;
      }
    }

    const allCards = await transaction.get(db.collection('prayerCards'));
    const activeCards = allCards.docs.filter(isActiveCard);
    if (activeCards.length < CARDS_PER_ROUND) {
      throw new HttpsError('failed-precondition', '기도카드가 충분히 준비되지 않았습니다.');
    }

    const chosenCards = pickUniqueCards(activeCards, CARDS_PER_ROUND);
    transaction.set(drawRef, {
      cardIds: chosenCards.map((card) => card.id),
      drawDate,
      assignedAt: FieldValue.serverTimestamp(),
    });
    return chosenCards;
  });

  const cards = assignedCards.map(asPrayerCard);
  if (cards.some((card) => !card.name || card.prayers.length === 0)) {
    throw new HttpsError('failed-precondition', '기도카드 데이터 형식이 올바르지 않습니다.');
  }

  return {
    cards,
    drawDate,
  };
});

/**
 * Gives each of today's three cards one fixed alternative. This permits a
 * visitor to skip their own card without making the private collection
 * enumerable from the browser.
 */
export const replaceDailyPrayerCard = onCall({
  cors: [
    'https://fam2-prayer-cards.web.app',
    'https://fam2-prayer-cards.firebaseapp.com',
    'https://jakjac7.github.io',
  ],
}, async (request) => {
  const cardId = request.data?.cardId;
  if (typeof cardId !== 'string' || !cardId) {
    throw new HttpsError('invalid-argument', '교체할 기도카드를 확인하지 못했습니다.');
  }

  const drawDate = koreaCalendarDate();
  const drawRef = db.collection('dailyPrayerDraws').doc(drawDate);
  const replacementSnapshot = await db.runTransaction(async (transaction) => {
    const existingDraw = await transaction.get(drawRef);
    if (!existingDraw.exists || !isValidCardIdList(existingDraw.data().cardIds)) {
      throw new HttpsError('failed-precondition', '오늘의 기도카드를 먼저 준비해주세요.');
    }

    const assignedCardIds = existingDraw.data().cardIds;
    const assignedIndex = assignedCardIds.indexOf(cardId);
    if (assignedIndex < 0) {
      throw new HttpsError('failed-precondition', '오늘 배정된 기도카드만 교체할 수 있습니다.');
    }

    let replacementCardIds = existingDraw.data().replacementCardIds;
    let generatedReplacementCardIds = null;
    if (!isValidCardIdList(replacementCardIds)) {
      const allCards = await transaction.get(db.collection('prayerCards'));
      const availableCards = allCards.docs.filter(
        (card) => isActiveCard(card) && !assignedCardIds.includes(card.id),
      );
      if (availableCards.length < CARDS_PER_ROUND) {
        throw new HttpsError('failed-precondition', '교체할 기도카드가 충분히 준비되지 않았습니다.');
      }

      replacementCardIds = pickUniqueCards(availableCards, CARDS_PER_ROUND).map((card) => card.id);
      generatedReplacementCardIds = replacementCardIds;
    }

    const snapshot = await transaction.get(
      db.collection('prayerCards').doc(replacementCardIds[assignedIndex]),
    );
    if (generatedReplacementCardIds) {
      transaction.set(drawRef, { replacementCardIds: generatedReplacementCardIds }, { merge: true });
    }
    return snapshot;
  });

  if (!replacementSnapshot.exists) {
    throw new HttpsError('failed-precondition', '교체할 기도카드를 준비하지 못했습니다.');
  }

  const card = asPrayerCard(replacementSnapshot);
  if (!card.name || card.prayers.length === 0) {
    throw new HttpsError('failed-precondition', '기도카드 데이터 형식이 올바르지 않습니다.');
  }

  return { card };
});
