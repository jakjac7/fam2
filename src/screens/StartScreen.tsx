export default function StartScreen({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="w-full max-w-sm prayer-card flex flex-col items-center text-center py-12">
        <h1 className="card-title text-4xl mb-6">THE BEAUTY OF GOD</h1>
        
        <p className="text-lg mb-12 text-black/80 font-medium">
          가족캠프2 리더<br/>
          기도카드 나눔
        </p>

        <button 
          type="button"
          onClick={onEnter}
          className="px-10 py-3 border-2 border-black text-black font-semibold tracking-widest active:bg-black/5 transition-colors"
        >
          ENTER
        </button>
      </div>
    </div>
  );
}
