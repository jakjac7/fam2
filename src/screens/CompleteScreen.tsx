export default function CompleteScreen({ onPrayMore, name }: { onPrayMore: () => void; name: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-full max-w-sm prayer-card flex flex-col items-center text-center py-16">
        <h1 className="card-title text-5xl mb-8">AMEN</h1>
        
        <p className="text-lg leading-relaxed text-black/85 font-medium break-keep">
          {name ? `${name}님, ` : ''}세 분의 리더를 위해<br/>
          함께 기도해 주셔서 감사합니다.
        </p>

        <button 
          type="button"
          onClick={onPrayMore}
          className="mt-10 px-6 py-3 border border-black/30 text-black/80 font-semibold tracking-wide active:bg-black/5 transition-colors"
        >
          같은 세 분을 다시 기도할게요
        </button>

        <div className="mt-12 text-xs tracking-widest font-semibold text-black/40">
          POD CHURCH
        </div>
      </div>
    </div>
  );
}
