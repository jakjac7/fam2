import { useEffect, useState } from 'react';
import type { PrayerCard } from '../types';

interface Props {
  card: PrayerCard;
  currentIndex: number;
  visitedCards: boolean[];
  onNavigate: (index: number) => void;
  onNext: () => void;
  onComplete: () => void;
  onReplace: () => Promise<void>;
  watermark: string;
}

export default function PrayerCardScreen({ 
  card, 
  currentIndex, 
  visitedCards, 
  onNavigate, 
  onNext, 
  onComplete,
  onReplace,
  watermark,
}: Props) {
  const isLast = currentIndex === visitedCards.length - 1;
  const canComplete = visitedCards.every(Boolean);
  const [isMyCard, setIsMyCard] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [replacementError, setReplacementError] = useState('');

  useEffect(() => {
    setIsMyCard(false);
    setReplacementError('');
  }, [card.id]);

  const handleReplace = async () => {
    if (!isMyCard || isReplacing) return;
    setIsReplacing(true);
    setReplacementError('');
    try {
      await onReplace();
    } catch {
      setReplacementError('카드를 교체하지 못했습니다. 잠시 후 다시 시도해주세요.');
      setIsReplacing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center py-6 px-4 animate-in fade-in duration-300">
      
      {/* Watermark */}
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center opacity-[0.02] z-0 overflow-hidden">
        <div className="rotate-[-30deg] text-4xl font-bold whitespace-nowrap text-black">
          {watermark}
        </div>
      </div>

      <div className="w-full max-w-[500px] flex-1 flex flex-col z-10">
        
        {/* Navigation */}
        <div className="flex justify-between items-center mb-4 px-2">
          <span className="text-sm font-semibold tracking-wide text-black/60">
            기도카드 {String(currentIndex + 1).padStart(2, '0')}
          </span>
          <div className="flex gap-2">
            {visitedCards.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onNavigate(idx)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors ${
                  currentIndex === idx 
                    ? 'bg-black text-white font-bold' 
                    : visitedCards[idx] 
                      ? 'bg-black/10 text-black font-medium'
                      : 'bg-transparent text-black/40 border border-black/20'
                }`}
                aria-label={`${idx + 1}번째 기도카드`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </div>

        {/* The Card */}
        <div className="prayer-card prayer-content flex flex-col mb-8">
          
          <h2 className="card-title text-2xl text-center mb-8">THE BEAUTY OF GOD</h2>
          
          {/* Header */}
          <div className="flex flex-col gap-3 mb-8">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[0.7rem] font-bold tracking-[0.16em] text-black/45">PRAY FOR</span>
              {card.cell && (
                <span className="rounded-full border border-black/15 bg-white/35 px-2.5 py-1 text-xs font-medium text-black/65">{card.cell}</span>
              )}
            </div>
            <span className="text-2xl font-bold leading-snug tracking-tight break-keep">{card.name}</span>
          </div>

          {/* Verse */}
          {card.verseText && (
            <div className="mb-8 rounded-sm bg-black/[0.035] px-4 py-4 space-y-2">
              <div className="text-sm font-semibold text-black/50">약속의 말씀</div>
              <div className="text-base leading-relaxed break-keep font-serif">
                “{card.verseText}”
              </div>
              {card.verseReference && (
                <div className="text-sm text-black/60 text-right">
                  {card.verseReference}
                </div>
              )}
            </div>
          )}

          {/* Prayers */}
          <div className="flex-1">
            <div className="text-xs font-bold tracking-[0.16em] text-black/50 mb-5">PRAYER POINTS</div>
            <ul className="space-y-5">
              {card.prayers.map((prayer, idx) => (
                <li key={idx} className="flex gap-3 prayer-item break-keep">
                  <span className="font-semibold text-black/60">{idx + 1}.</span>
                  <span>{prayer}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 text-center text-xs tracking-widest font-semibold text-black/40">
            POD CHURCH
          </div>
        </div>

        {/* Action Bottom */}
        <div className="sticky-amen flex flex-col gap-3">
          <div className="rounded-sm border border-black/15 bg-white/35 px-4 py-3">
            <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-black/75">
              <input
                type="checkbox"
                checked={isMyCard}
                disabled={isReplacing}
                onChange={(event) => setIsMyCard(event.target.checked)}
                className="h-4 w-4 accent-black"
              />
              본인 카드입니다
            </label>
            {isMyCard && (
              <button
                type="button"
                onClick={() => void handleReplace()}
                disabled={isReplacing}
                className="mt-3 w-full border border-black/35 py-2.5 text-sm font-semibold text-black active:bg-black/5 disabled:text-black/35"
              >
                {isReplacing ? '다른 기도카드를 준비하는 중…' : '다른 기도카드로 교체하기'}
              </button>
            )}
            {replacementError && <p className="mt-2 text-xs text-red-700">{replacementError}</p>}
          </div>
          {!isLast ? (
            <button
              onClick={onNext}
              type="button"
              className="w-full py-4 bg-transparent border-2 border-black text-black font-semibold text-lg active:bg-black/5 transition-colors flex items-center justify-center gap-2"
            >
              다음 기도카드 <span>→</span>
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              {!canComplete && (
                <p className="text-center text-sm text-black/60 mb-2 font-medium">
                  세 분의 기도카드를 모두 확인해주세요
                </p>
              )}
              <button
                onClick={onComplete}
                type="button"
                disabled={!canComplete}
                className={`w-full py-4 font-semibold text-lg transition-colors ${
                  canComplete
                    ? 'bg-black text-white active:scale-[0.98]'
                    : 'bg-black/10 text-black/40 cursor-not-allowed'
                }`}
              >
                아멘 · 기도하였습니다
              </button>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
