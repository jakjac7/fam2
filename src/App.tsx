import { useAppState } from './hooks/useAppState';
import { CARDS_PER_ROUND } from './data/prayerCards';
import { usePrayerAccess } from './hooks/usePrayerAccess';
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
  cards: Parameters<typeof useAppState>[0];
  drawDate: string;
}) {
  const {
    state,
    handleConsent,
    navigateToCard,
    nextCard,
    completePrayer,
    prayMore,
    beginConsent,
  } = useAppState(cards, drawDate);
  const cardById = new Map(cards.map((card) => [card.id, card] as const));
  const currentCard = cardById.get(state.selectedCardIds[state.currentCardIndex]);
  const cardsAreReady = cards.length >= CARDS_PER_ROUND;

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
          watermark={`${drawDate} · 기도 전용 · 외부 공유 금지`}
        />
      )}
      {state.screen === 'complete' && <CompleteScreen onPrayMore={prayMore} />}
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

