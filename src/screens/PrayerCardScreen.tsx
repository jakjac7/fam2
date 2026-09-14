import { useState } from 'react';
import { PrayerCard } from '../types';

interface Props {
  card: PrayerCard;
  currentIndex: number;
  visitedCards: boolean[];
  onNavigate: (index: number) => void;
  onNext: () => void;
  onReplace: () => void;
  onComplete: () => void;
}

export default function PrayerCardScreen({ 
  card, 
  currentIndex, 
  visitedCards, 
  onNavigate, 
  onNext, 
  onReplace, 
  onComplete 
}: Props) {
  const [isSelf, setIsSelf] = useState(false);
  const isLast = currentIndex === 2;
  const canComplete = visitedCards.every(Boolean);

  const handleReplace = () => {
    setIsSelf(false);
    onReplace();
  };

  return (
    <div className="min-h-screen flex flex-col items-center py-6 px-4 animate-in fade-in duration-300">
      
      {/* Watermark */}
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center opacity-[0.02] z-0 overflow-hidden">
        <div className="rotate-[-30deg] text-4xl font-bold whitespace-nowrap text-black">
          기도 전용 · 외부 공유 금지
        </div>
      </div>

      <div className="w-full max-w-[500px] flex-1 flex flex-col z-10">
        
        {/* Navigation */}
        <div className="flex justify-between items-center mb-4 px-2">
          <span className="text-sm font-semibold tracking-wide text-black/60">
            기도카드 0{currentIndex + 1}
          </span>
          <div className="flex gap-2">
            {[0, 1, 2].map((idx) => (
              <button
                key={idx}
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
          <div className="flex justify-between items-end mb-6">
            <div className="flex items-baseline gap-3">
              <span className="text-sm font-semibold text-black/50">이름</span>
              <span className="text-xl font-bold tracking-widest">{card.name}</span>
            </div>
            {card.cell && (
              <span className="text-sm text-black/70">({card.cell})</span>
            )}
          </div>
          
          <div className="rule mb-6"></div>

          {/* Verse */}
          {card.verseText && (
            <div className="mb-6 space-y-2">
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

          <div className="rule mb-6"></div>

          {/* Prayers */}
          <div className="flex-1">
            <div className="text-sm font-semibold text-black/50 mb-4">기도제목</div>
            <ul className="space-y-5">
              {card.prayers.map((prayer, idx) => (
                <li key={idx} className="flex gap-3 prayer-item break-keep">
                  <span className="font-semibold text-black/60">{idx + 1}.</span>
                  <span>{prayer}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Self Replacement */}
          <div className="mt-12 flex flex-col items-end gap-3">
            <label className="flex items-center gap-2 text-sm text-black/70 cursor-pointer">
              <input 
                type="checkbox" 
                checked={isSelf}
                onChange={(e) => setIsSelf(e.target.checked)}
                className="w-4 h-4 accent-black"
              />
              본인의 기도카드인가요?
            </label>
            <button
              onClick={handleReplace}
              disabled={!isSelf}
              className={`text-sm px-4 py-2 border transition-colors ${
                isSelf 
                  ? 'border-black text-black hover:bg-black/5' 
                  : 'border-transparent text-black/30'
              }`}
            >
              다른 기도카드 받기
            </button>
          </div>

          <div className="mt-8 text-center text-xs tracking-widest font-semibold text-black/40">
            POD CHURCH
          </div>
        </div>

        {/* Action Bottom */}
        <div className="sticky-amen flex flex-col gap-3">
          {!isLast ? (
            <button
              onClick={onNext}
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
