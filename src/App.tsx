import { useEffect, useMemo, useState } from 'react';
import { useAppState } from './hooks/useAppState';
import { CARDS_PER_ROUND } from './data/prayerCards';
import { normalizePrayerCards } from './data/prayerCards';
import { usePrayerAccess } from './hooks/usePrayerAccess';
import { getAdditionalPrayerCards, replaceDailyPrayerCard } from './lib/firebase';
import type { PrayerCard } from './types';
import StartScreen from './screens/StartScreen';
import ConsentScreen from './screens/ConsentScreen';
import PrayerCardScreen from './screens/PrayerCardScreen';
import CompleteScreen from './screens/CompleteScreen';
import PrivacyGuard from './components/PrivacyGuard';
import LoginScreen from './screens/LoginScreen';
import SetupScreen from './screens/SetupScreen';

function PrayerExperience({
  cards,
  drawDate,
}: {
  cards: PrayerCard[];
  drawDate: string;
}) {
  const [roundCards, setRoundCards] = useState(cards);
  useEffect(() => setRoundCards(cards), [cards, drawDate]);
  const {
    state,
    handleConsent,
    navigateToCard,
    nextCard,
    completePrayer,
    prayMore,
    addAdditionalCards,
    beginConsent,
    replaceCurrentCard,
  } = useAppState(roundCards, drawDate);
  const cardById = new Map<string, PrayerCard>(
    roundCards.map((card) => [card.id, card] as const),
  );
  const dailyCardIds = useMemo(() => new Set(cards.map((card) => card.id)), [cards]);
  const currentCard = cardById.get(state.selectedCardIds[state.currentCardIndex]);
  const cardsAreReady = cards.length >= CARDS_PER_ROUND;

  const handleReplace = async () => {
    if (!currentCard) return;
    const result = await replaceDailyPrayerCard(currentCard.id);
    const [replacement] = normalizePrayerCards([result.card]);
    if (!replacement) throw new Error('교체할 기도카드를 준비하지 못했습니다.');
    setRoundCards((current) => [...current.filter((card) => card.id !== replacement.id), replacement]);
    replaceCurrentCard(replacement.id);
  };

  const handlePrayForAdditionalLeaders = async () => {
    const result = await getAdditionalPrayerCards();
    if (result.drawDate !== drawDate) {
      throw new Error('기도 대상이 새로 갱신되었습니다. 페이지를 새로고침해 주세요.');
    }

    const additionalCards = normalizePrayerCards(result.cards);
    if (additionalCards.length !== CARDS_PER_ROUND) {
      throw new Error('추가 기도카드를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
    if (additionalCards.some((card) => roundCards.some((current) => current.id === card.id))) {
      throw new Error('중복되지 않는 추가 기도카드를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }

    setRoundCards((current) => [...current, ...additionalCards]);
    addAdditionalCards(additionalCards.map((card) => card.id));
  };

  return (
    <main className="w-full relative selection:bg-black/10">
      <PrivacyGuard />
      {state.screen === 'start' && (
        <StartScreen
          onEnter={beginConsent}
          cardsAreReady={cardsAreReady}
          drawDate={drawDate}
        />
      )}
      {state.screen === 'consent' && <ConsentScreen onConsent={handleConsent} />}
      {state.screen === 'prayer' && currentCard && (
        <PrayerCardScreen
          card={currentCard}
          currentIndex={state.currentCardIndex}
          visitedCards={state.visitedCards}
          onNavigate={navigateToCard}
          onNext={nextCard}
          onComplete={completePrayer}
          onReplace={handleReplace}
          canReplace={dailyCardIds.has(currentCard.id)}
          leaderCount={state.selectedCardIds.length}
          watermark={`${drawDate} · 기도 전용 · 외부 공유 금지`}
        />
      )}
      {state.screen === 'complete' && (
        <CompleteScreen
          onPrayMore={prayMore}
          onPrayAdditional={handlePrayForAdditionalLeaders}
          name={state.prayerName}
          drawDate={drawDate}
          leaderCount={state.selectedCardIds.length}
        />
      )}
    </main>
  );
}

export default function App() {
  const { state, load } = usePrayerAccess();

  if (state.status === 'configuration-needed') return <SetupScreen />;
  if (state.status === 'loading') return <LoginScreen mode="loading" />;
  if (state.status === 'error') return <LoginScreen mode="error" message={state.message} onRetry={load} />;

  return (
    <PrayerExperience
      cards={state.cards}
      drawDate={state.drawDate}
    />
  );
}

