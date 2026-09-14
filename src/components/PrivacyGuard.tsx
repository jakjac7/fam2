import { useEffect, useState } from 'react';

export default function PrivacyGuard() {
  const [isCovered, setIsCovered] = useState(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsCovered(true);
      }
    };

    const handleBlur = () => {
      setIsCovered(true);
    };
    
    // Disable right click, copy, drag across the app
    const preventAction = (e: Event) => {
      if ((e.target as HTMLElement)?.closest?.('.prayer-card') || (e.target as HTMLElement)?.closest?.('.privacy-protected')) {
        e.preventDefault();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('contextmenu', preventAction);
    document.addEventListener('copy', preventAction);
    document.addEventListener('cut', preventAction);
    document.addEventListener('dragstart', preventAction);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('contextmenu', preventAction);
      document.removeEventListener('copy', preventAction);
      document.removeEventListener('cut', preventAction);
      document.removeEventListener('dragstart', preventAction);
    };
  }, []);

  if (!isCovered) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#E9E3D8] text-[#222222] p-6 text-center animate-in fade-in duration-200">
      <div className="prayer-card w-full max-w-sm p-8 flex flex-col items-center gap-6">
        <h2 className="card-title text-3xl font-bold tracking-tighter">THE BEAUTY OF GOD</h2>
        
        <p className="text-lg leading-relaxed text-[#34322F]">
          기도카드 보호를 위해<br/>
          화면을 잠시 가렸습니다.
        </p>

        <button 
          onClick={() => setIsCovered(false)}
          className="mt-4 px-8 py-3 bg-[#222222] text-[#FFFDF8] text-base font-medium active:scale-95 transition-transform"
        >
          다시 보기
        </button>
      </div>
    </div>
  );
}
