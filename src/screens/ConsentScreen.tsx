import { useEffect, useState } from 'react';

export default function ConsentScreen({ onConsent }: { onConsent: () => void }) {
  const [agreed, setAgreed] = useState(false);

  const handleAgree = () => {
    if (agreed) return;
    setAgreed(true);
  };

  useEffect(() => {
    if (!agreed) return;

    const transitionTimer = window.setTimeout(onConsent, 400);
    return () => window.clearTimeout(transitionTimer);
  }, [agreed, onConsent]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="w-full max-w-sm prayer-card flex flex-col py-10 px-8">
        
        <div className="space-y-6 text-[1.05rem] leading-[1.7] text-black/85 mb-10 text-center break-keep">
          <p>
            가족캠프2 리더들을<br/>중보하기 위한 페이지입니다.
          </p>
          <p>
            기도카드를 통해 알게 된 내용을<br/>
            중보기도 외의 목적으로<br/>
            이용하지 않겠습니다.
          </p>
        </div>

        <button 
          type="button"
          onClick={handleAgree}
          disabled={agreed}
          className={`flex items-center justify-center gap-3 py-4 border-2 transition-all ${
            agreed 
              ? 'bg-black border-black text-white' 
              : 'border-black text-black active:bg-black/5'
          }`}
        >
          <span className="text-xl leading-none">{agreed ? '☑' : '□'}</span>
          <span className="font-semibold tracking-wide">{agreed ? '동의했습니다' : '동의합니다'}</span>
        </button>

      </div>
    </div>
  );
}
