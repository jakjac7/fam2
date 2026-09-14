import { useAppState } from './hooks/useAppState';
import { PRAYER_CARD_BY_ID } from './data/prayerCards';
import StartScreen from './screens/StartScreen';
import ConsentScreen from './screens/ConsentScreen';
import PrayerCardScreen from './screens/PrayerCardScreen';
import CompleteScreen from './screens/CompleteScreen';
import PrivacyGuard from './components/PrivacyGuard';

export default function App() {
  const { 
    state, 
    handleConsent, 
    navigateToCard, 
    nextCard, 
    replaceCurrentCard, 
    completePrayer,
    prayMore,
    beginConsent
  } = useAppState();

  const currentCard = PRAYER_CARD_BY_ID.get(state.selectedCardIds[state.currentCardIndex]);

  return (
    <main className="w-full relative selection:bg-black/10">
      <PrivacyGuard />
      
      {state.screen === 'start' && (
        <StartScreen onEnter={beginConsent} />
      )}

      {state.screen === 'consent' && (
        <ConsentScreen onConsent={handleConsent} />
      )}

      {state.screen === 'prayer' && currentCard && (
        <PrayerCardScreen 
          card={currentCard}
          currentIndex={state.currentCardIndex}
          visitedCards={state.visitedCards}
          onNavigate={navigateToCard}
          onNext={nextCard}
          onReplace={replaceCurrentCard}
          onComplete={completePrayer}
        />
      )}

      {state.screen === 'complete' && (
        <CompleteScreen onPrayMore={prayMore} />
      )}
    </main>
  );
}

