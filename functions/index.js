import { createHash, randomBytes, randomInt } from 'node:crypto';
import sharp from 'sharp';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

initializeApp();
setGlobalOptions({ region: 'asia-northeast3', maxInstances: 10 });

const db = getFirestore();
const CARDS_PER_ROUND = 3;
const KOREA_TIME_ZONE = 'Asia/Seoul';
const DRAW_HOUR = 20;
const DRAW_MINUTE = 30;
const DRAW_SCHEDULE_VERSION = '20:30-kst-v1';
const PRAYER_SESSIONS_COLLECTION = 'prayerSessions';
const PRAYER_SESSION_CLIENTS_COLLECTION = 'prayerSessionClients';
const MAX_SESSIONS_PER_CLIENT_PER_DRAW = 3;
const MAX_SESSION_RESUMES_PER_SESSION = 5;
const MAX_PRIMARY_READS_PER_SESSION = 3;
const MAX_ADDITIONAL_READS_PER_SESSION = 2;
const MAX_CERTIFICATE_DOWNLOADS_PER_SESSION = 5;
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,}$/;
const CLIENT_ID_PATTERN = /^[a-f0-9]{32}$/i;
const CALLABLE_CORS = [
  'https://fam2-prayer-cards.web.app',
  'https://fam2-prayer-cards.firebaseapp.com',
  'https://jakjac7.github.io',
];

function koreaDateTimeParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: KOREA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${byType.year}-${byType.month}-${byType.day}`,
    hour: Number(byType.hour),
    minute: Number(byType.minute),
  };
}

function koreaPrayerRoundDate(now = new Date()) {
  const { date, hour, minute } = koreaDateTimeParts(now);
  if (hour < DRAW_HOUR || (hour === DRAW_HOUR && minute < DRAW_MINUTE)) {
    return calendarDaysBefore(date, 1);
  }
  return date;
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

function isCalendarDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function hashOpaqueValue(value) {
  return createHash('sha256').update(value).digest('base64url');
}

function newSessionToken() {
  return randomBytes(32).toString('base64url');
}

function prayerSessionRef(sessionToken) {
  if (typeof sessionToken !== 'string' || !SESSION_TOKEN_PATTERN.test(sessionToken)) {
    throw new HttpsError('unauthenticated', '유효한 기도 세션이 필요합니다.');
  }
  return db.collection(PRAYER_SESSIONS_COLLECTION).doc(hashOpaqueValue(sessionToken));
}

function sessionClientRef(drawDate, clientId) {
  if (typeof clientId !== 'string' || !CLIENT_ID_PATTERN.test(clientId)) {
    throw new HttpsError('invalid-argument', '안전한 기기 식별자를 확인하지 못했습니다.');
  }
  return db.collection(PRAYER_SESSION_CLIENTS_COLLECTION).doc(`${drawDate}-${hashOpaqueValue(clientId)}`);
}

function isPrayerSessionForDraw(snapshot, drawDate) {
  if (!snapshot.exists) return false;
  const session = snapshot.data();
  return session.drawDate === drawDate;
}

/**
 * Session capabilities are deliberately narrow: retries can only return the
 * same fixed draw, and each endpoint has a bounded retry allowance.
 */
async function consumeSessionAllowance(sessionToken, drawDate, field, maximum) {
  const ref = prayerSessionRef(sessionToken);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!isPrayerSessionForDraw(snapshot, drawDate)) {
      throw new HttpsError('unauthenticated', '기도 세션이 만료되었습니다. 페이지를 새로고침해 다시 시작해 주세요.');
    }

    const current = Number(snapshot.data()[field] ?? 0);
    if (!Number.isSafeInteger(current) || current >= maximum) {
      throw new HttpsError('resource-exhausted', '이 세션의 재요청 한도를 초과했습니다. 잠시 후 새로고침해 주세요.');
    }

    transaction.update(ref, {
      [field]: current + 1,
      lastAccessAt: FieldValue.serverTimestamp(),
    });
    return snapshot.data();
  });
}

async function startOrResumePrayerSession({ clientId, sessionToken }) {
  const drawDate = koreaPrayerRoundDate();

  if (typeof sessionToken === 'string' && sessionToken) {
    const data = await consumeSessionAllowance(
      sessionToken,
      drawDate,
      'sessionResumes',
      MAX_SESSION_RESUMES_PER_SESSION,
    );
    return {
      drawDate,
      sessionToken,
      replacementUsed: typeof data.replacedPrimaryCardId === 'string',
    };
  }

  const clientRef = sessionClientRef(drawDate, clientId);
  const token = newSessionToken();
  const sessionRef = prayerSessionRef(token);
  await db.runTransaction(async (transaction) => {
    const clientSnapshot = await transaction.get(clientRef);
    const sessionStarts = clientSnapshot.exists ? Number(clientSnapshot.data().sessionStarts ?? 0) : 0;
    if (!Number.isSafeInteger(sessionStarts) || sessionStarts >= MAX_SESSIONS_PER_CLIENT_PER_DRAW) {
      throw new HttpsError(
        'resource-exhausted',
        '오늘 이 기기에서 새 기도 세션을 너무 많이 시작했습니다. 기존 탭을 사용해 주세요.',
      );
    }

    transaction.set(clientRef, {
      drawDate,
      sessionStarts: sessionStarts + 1,
      lastStartedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.create(sessionRef, {
      drawDate,
      clientIdHash: hashOpaqueValue(clientId),
      createdAt: FieldValue.serverTimestamp(),
      lastAccessAt: FieldValue.serverTimestamp(),
      primaryReads: 1,
      sessionResumes: 0,
      additionalReads: 0,
      certificateDownloads: 0,
      replacedPrimaryCardId: null,
    });
  });

  return { drawDate, sessionToken: token, replacementUsed: false };
}

function escapeSvgText(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  })[character]);
}

function amenCertificateSvg(name, drawDate, leaderCount) {
  const displayName = escapeSvgText(name || '기도자');
  const formattedDate = drawDate.replaceAll('-', '.');
  const leaderCountText = leaderCount === 6 ? '여섯 분' : '세 분';

  return `
    <svg width="720" height="900" viewBox="0 0 720 900" xmlns="http://www.w3.org/2000/svg">
      <rect width="720" height="900" fill="#DDD7CC"/>
      <rect x="53" y="67" width="614" height="766" fill="#F8F2E7" stroke="#34322F" stroke-width="2"/>
      <rect x="65" y="79" width="590" height="742" fill="none" stroke="#34322F" stroke-opacity=".45"/>
      <g fill="#222222" text-anchor="middle">
        <text x="360" y="273" font-family="Georgia, serif" font-size="79" font-weight="700">AMEN</text>
        <text x="360" y="380" font-family="Noto Sans KR, Arial, sans-serif" font-size="32" font-weight="600">${displayName}님,</text>
        <text x="360" y="437" font-family="Noto Sans KR, Arial, sans-serif" font-size="30">${leaderCountText}의 리더를 위해</text>
        <text x="360" y="483" font-family="Noto Sans KR, Arial, sans-serif" font-size="30">함께 기도했습니다.</text>
      </g>
      <path d="M180 557 H540" stroke="#222222" stroke-opacity=".22" stroke-width="1.5"/>
      <text x="360" y="613" fill="#222222" fill-opacity=".55" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="600">${formattedDate}</text>
      <text x="360" y="727" fill="#222222" fill-opacity=".45" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" font-weight="600" letter-spacing="2">POD CHURCH</text>
    </svg>
  `;
}

function calendarDaysBefore(date, days) {
  const calendarDate = new Date(`${date}T00:00:00Z`);
  calendarDate.setUTCDate(calendarDate.getUTCDate() - days);
  return calendarDate.toISOString().slice(0, 10);
}

function drawDetails(snapshot) {
  const draw = snapshot.data();
  const drawDate = isCalendarDate(draw.drawDate)
    ? draw.drawDate
    : isCalendarDate(snapshot.id)
      ? snapshot.id
      : null;
  const primaryCardIds = isValidCardIdList(draw.cardIds) ? draw.cardIds : [];
  const additionalCardIds = isValidCardIdList(draw.additionalCardIds) ? draw.additionalCardIds : [];
  const replacementUsedCardIds = Array.isArray(draw.replacementUsedCardIds)
    ? draw.replacementUsedCardIds.filter((cardId) => typeof cardId === 'string' && cardId)
    : [];
  return {
    drawDate,
    // Only cards actually delivered to a visitor count in the history.
    cardIds: [...primaryCardIds, ...additionalCardIds, ...replacementUsedCardIds],
  };
}

function buildSelectionHistory(drawSnapshots, beforeDate) {
  const recentDates = new Set(
    Array.from({ length: 5 }, (_, index) => calendarDaysBefore(beforeDate, index + 1)),
  );
  const recentCardIds = new Set();
  const history = new Map();

  for (const snapshot of drawSnapshots) {
    const { drawDate, cardIds } = drawDetails(snapshot);
    if (!drawDate || drawDate >= beforeDate) continue;

    for (const cardId of cardIds) {
      if (recentDates.has(drawDate)) recentCardIds.add(cardId);

      const previous = history.get(cardId) ?? { count: 0, lastSelectedDate: '' };
      history.set(cardId, {
        count: previous.count + 1,
        lastSelectedDate: previous.lastSelectedDate > drawDate ? previous.lastSelectedDate : drawDate,
      });
    }
  }

  return { history, recentCardIds };
}

function chooseFairCards(activeCards, drawSnapshots, drawDate, excludedCardIds = new Set()) {
  const { history, recentCardIds } = buildSelectionHistory(drawSnapshots, drawDate);
  const availableCards = activeCards.filter((card) => !excludedCardIds.has(card.id));
  if (availableCards.length < CARDS_PER_ROUND) {
    throw new HttpsError(
      'failed-precondition',
      '추출할 기도카드가 충분하지 않습니다.',
    );
  }

  const recentFiveDayExcludedCards = availableCards.filter((card) => !recentCardIds.has(card.id));
  // Five days without repetition is the preferred rule. With a compact
  // roster it can make an additional round impossible, so fall back to all
  // available cards while preserving the long-term fairness priorities below.
  const selectionPool = recentFiveDayExcludedCards.length >= CARDS_PER_ROUND
    ? recentFiveDayExcludedCards
    : availableCards;

  // Shuffle only breaks complete ties; the fairness priority remains fixed.
  return pickUniqueCards(selectionPool, selectionPool.length)
    .sort((left, right) => {
      const leftHistory = history.get(left.id) ?? { count: 0, lastSelectedDate: '' };
      const rightHistory = history.get(right.id) ?? { count: 0, lastSelectedDate: '' };
      if (leftHistory.count !== rightHistory.count) return leftHistory.count - rightHistory.count;
      return leftHistory.lastSelectedDate.localeCompare(rightHistory.lastSelectedDate);
    })
    .slice(0, CARDS_PER_ROUND);
}

async function getOrCreateDailyDraw(drawDate, { replaceLegacyDraw = false } = {}) {
  const drawRef = db.collection('dailyPrayerDraws').doc(drawDate);
  return db.runTransaction(async (transaction) => {
    const existingDraw = await transaction.get(drawRef);
    const existingCardIds = existingDraw.exists ? existingDraw.data().cardIds : null;
    const wasCreatedForEveningSchedule = existingDraw.exists
      && existingDraw.data().scheduleVersion === DRAW_SCHEDULE_VERSION;

    if (isValidCardIdList(existingCardIds) && (!replaceLegacyDraw || wasCreatedForEveningSchedule)) {
      const snapshots = await Promise.all(
        existingCardIds.map((cardId) => transaction.get(db.collection('prayerCards').doc(cardId))),
      );
      if (snapshots.every((snapshot) => snapshot.exists)) return snapshots;
    }

    const [allCards, allDraws] = await Promise.all([
      transaction.get(db.collection('prayerCards')),
      transaction.get(db.collection('dailyPrayerDraws')),
    ]);
    const activeCards = allCards.docs.filter(isActiveCard);
    if (activeCards.length < CARDS_PER_ROUND) {
      throw new HttpsError('failed-precondition', '기도카드가 충분히 준비되지 않았습니다.');
    }

    const chosenCards = chooseFairCards(activeCards, allDraws.docs, drawDate);
    transaction.set(drawRef, {
      cardIds: chosenCards.map((card) => card.id),
      drawDate,
      assignedAt: FieldValue.serverTimestamp(),
      scheduleVersion: DRAW_SCHEDULE_VERSION,
    });
    return chosenCards;
  });
}

/**
 * Starts one short-lived browser session. The initial response always
 * contains exactly the shared three-card draw; the card collection itself is
 * never sent to the browser.
 */
export const startPrayerSession = onCall({
  cors: CALLABLE_CORS,
}, async (request) => {
  const session = await startOrResumePrayerSession(request.data ?? {});
  const { drawDate } = session;
  const assignedCards = await getOrCreateDailyDraw(drawDate);

  const cards = assignedCards.map(asPrayerCard);
  if (cards.some((card) => !card.name || card.prayers.length === 0)) {
    throw new HttpsError('failed-precondition', '기도카드 데이터 형식이 올바르지 않습니다.');
  }

  return {
    cards,
    drawDate,
    sessionToken: session.sessionToken,
    replacementUsed: session.replacementUsed,
  };
});

/**
 * Kept only for a controlled retry path. It no longer grants an anonymous
 * browser access to the three daily cards.
 */
export const getDailyPrayerCards = onCall({
  cors: CALLABLE_CORS,
}, async (request) => {
  const drawDate = koreaPrayerRoundDate();
  await consumeSessionAllowance(
    request.data?.sessionToken,
    drawDate,
    'primaryReads',
    MAX_PRIMARY_READS_PER_SESSION,
  );
  const assignedCards = await getOrCreateDailyDraw(drawDate);
  const cards = assignedCards.map(asPrayerCard);
  if (cards.some((card) => !card.name || card.prayers.length === 0)) {
    throw new HttpsError('failed-precondition', '기도카드 데이터 형식이 올바르지 않습니다.');
  }
  return { cards, drawDate };
});

/**
 * Returns one date-fixed additional round. The initial daily draw and any
 * card already reserved as a replacement are excluded, so no visitor sees a
 * duplicate when they choose to pray for three more leaders.
 */
async function getOrCreateAdditionalDailyDraw(drawDate) {
  await getOrCreateDailyDraw(drawDate);
  const drawRef = db.collection('dailyPrayerDraws').doc(drawDate);

  return db.runTransaction(async (transaction) => {
    const existingDraw = await transaction.get(drawRef);
    if (!existingDraw.exists || !isValidCardIdList(existingDraw.data().cardIds)) {
      throw new HttpsError('failed-precondition', '오늘의 기도카드를 먼저 준비해주세요.');
    }

    const existingAdditionalCardIds = existingDraw.data().additionalCardIds;
    if (isValidCardIdList(existingAdditionalCardIds)) {
      const snapshots = await Promise.all(
        existingAdditionalCardIds.map((cardId) => transaction.get(db.collection('prayerCards').doc(cardId))),
      );
      if (snapshots.every((snapshot) => snapshot.exists)) return snapshots;
    }

    const [allCards, allDraws] = await Promise.all([
      transaction.get(db.collection('prayerCards')),
      transaction.get(db.collection('dailyPrayerDraws')),
    ]);
    const primaryCardIds = existingDraw.data().cardIds;
    const replacementCardIds = isValidCardIdList(existingDraw.data().replacementCardIds)
      ? existingDraw.data().replacementCardIds
      : [];
    const excludedCardIds = new Set([...primaryCardIds, ...replacementCardIds]);
    const additionalCards = chooseFairCards(
      allCards.docs.filter(isActiveCard),
      allDraws.docs,
      drawDate,
      excludedCardIds,
    );

    transaction.set(drawRef, {
      additionalCardIds: additionalCards.map((card) => card.id),
      additionalAssignedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return additionalCards;
  });
}

export const getAdditionalPrayerCards = onCall({
  cors: CALLABLE_CORS,
}, async (request) => {
  const drawDate = koreaPrayerRoundDate();
  await consumeSessionAllowance(
    request.data?.sessionToken,
    drawDate,
    'additionalReads',
    MAX_ADDITIONAL_READS_PER_SESSION,
  );
  const assignedCards = await getOrCreateAdditionalDailyDraw(drawDate);
  const cards = assignedCards.map(asPrayerCard);
  if (cards.some((card) => !card.name || card.prayers.length === 0)) {
    throw new HttpsError('failed-precondition', '추가 기도카드 데이터 형식이 올바르지 않습니다.');
  }

  return { cards, drawDate };
});

/**
 * Serves a real PNG attachment for KakaoTalk's in-app browser. Unlike a Blob
 * URL created in the page, this response is handled by the browser downloader.
 * A valid prayer-session capability is required. The request carries only the
 * voluntary display name and draw date; no prayer-card content is read here.
 */
export const downloadAmenImage = onRequest(async (request, response) => {
  if (request.method !== 'GET') {
    response.set('Allow', 'GET').status(405).send('Method Not Allowed');
    return;
  }

  const requestSession = typeof request.query.session === 'string' ? request.query.session : '';
  try {
    await consumeSessionAllowance(
      requestSession,
      koreaPrayerRoundDate(),
      'certificateDownloads',
      MAX_CERTIFICATE_DOWNLOADS_PER_SESSION,
    );
  } catch (error) {
    const status = error instanceof HttpsError && error.code === 'resource-exhausted' ? 429 : 401;
    response.status(status).set('Cache-Control', 'no-store').send('Prayer session required');
    return;
  }

  const requestName = typeof request.query.name === 'string' ? request.query.name.trim() : '';
  const requestDate = typeof request.query.date === 'string' ? request.query.date : '';
  const name = requestName.slice(0, 24);
  const drawDate = isCalendarDate(requestDate) ? requestDate : koreaPrayerRoundDate();
  const leaderCount = request.query.count === '6' ? 6 : 3;
  const image = await sharp(Buffer.from(amenCertificateSvg(name, drawDate, leaderCount)))
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();

  response
    .status(200)
    .set({
      'Content-Type': 'image/png',
      'Content-Length': String(image.length),
      'Content-Disposition': `attachment; filename="amen-prayer-${drawDate}.png"`,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    })
    .send(image);
});

/** Prepares the next shared three-card round at 20:30 every evening in Korea. */
export const refreshDailyPrayerCards = onSchedule({
  schedule: '30 20 * * *',
  timeZone: KOREA_TIME_ZONE,
}, async () => {
  const drawDate = koreaPrayerRoundDate();
  await getOrCreateDailyDraw(drawDate, { replaceLegacyDraw: true });
});

/**
 * Gives each of today's three cards one fixed alternative. This permits a
 * visitor to skip their own card without making the private collection
 * enumerable from the browser.
 */
export const replaceDailyPrayerCard = onCall({
  cors: CALLABLE_CORS,
}, async (request) => {
  const cardId = request.data?.cardId;
  const sessionToken = request.data?.sessionToken;
  if (typeof cardId !== 'string' || !cardId) {
    throw new HttpsError('invalid-argument', '교체할 기도카드를 확인하지 못했습니다.');
  }

  const drawDate = koreaPrayerRoundDate();
  const drawRef = db.collection('dailyPrayerDraws').doc(drawDate);
  const sessionRef = prayerSessionRef(sessionToken);
  const replacementSnapshot = await db.runTransaction(async (transaction) => {
    const [sessionSnapshot, existingDraw] = await Promise.all([
      transaction.get(sessionRef),
      transaction.get(drawRef),
    ]);
    if (!isPrayerSessionForDraw(sessionSnapshot, drawDate)) {
      throw new HttpsError('unauthenticated', '기도 세션이 만료되었습니다. 페이지를 새로고침해 다시 시작해 주세요.');
    }
    if (!existingDraw.exists || !isValidCardIdList(existingDraw.data().cardIds)) {
      throw new HttpsError('failed-precondition', '오늘의 기도카드를 먼저 준비해주세요.');
    }

    const assignedCardIds = existingDraw.data().cardIds;
    const assignedIndex = assignedCardIds.indexOf(cardId);
    if (assignedIndex < 0) {
      throw new HttpsError('failed-precondition', '오늘 배정된 기도카드만 교체할 수 있습니다.');
    }

    const alreadyReplaced = sessionSnapshot.data().replacedPrimaryCardId;
    if (typeof alreadyReplaced === 'string' && alreadyReplaced !== cardId) {
      throw new HttpsError('resource-exhausted', '한 기도 세션에서는 카드 한 장만 교체할 수 있습니다.');
    }

    let replacementCardIds = existingDraw.data().replacementCardIds;
    let generatedReplacementCardIds = null;
    if (!isValidCardIdList(replacementCardIds)) {
      const [allCards, allDraws] = await Promise.all([
        transaction.get(db.collection('prayerCards')),
        transaction.get(db.collection('dailyPrayerDraws')),
      ]);
      const additionalCardIds = isValidCardIdList(existingDraw.data().additionalCardIds)
        ? existingDraw.data().additionalCardIds
        : [];
      const unavailableCardIds = new Set([...assignedCardIds, ...additionalCardIds]);
      const availableCards = allCards.docs.filter(
        (card) => isActiveCard(card) && !unavailableCardIds.has(card.id),
      );

      replacementCardIds = chooseFairCards(availableCards, allDraws.docs, drawDate).map((card) => card.id);
      generatedReplacementCardIds = replacementCardIds;
    }

    const snapshot = await transaction.get(
      db.collection('prayerCards').doc(replacementCardIds[assignedIndex]),
    );
    if (generatedReplacementCardIds) {
      transaction.set(drawRef, { replacementCardIds: generatedReplacementCardIds }, { merge: true });
    }
    transaction.set(drawRef, {
      replacementUsedCardIds: FieldValue.arrayUnion(replacementCardIds[assignedIndex]),
    }, { merge: true });
    if (alreadyReplaced !== cardId) {
      transaction.update(sessionRef, {
        replacedPrimaryCardId: cardId,
        lastAccessAt: FieldValue.serverTimestamp(),
      });
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
