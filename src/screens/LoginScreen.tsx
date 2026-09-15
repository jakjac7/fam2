interface Props {
  mode: 'loading' | 'error';
  message?: string;
  onRetry?: () => void;
}

export default function LoginScreen({ mode, message, onRetry }: Props) {
  const isLoading = mode === 'loading';

  return (
    <main className="min-h-screen flex items-center justify-center p-6 animate-in fade-in duration-300">
      <section className="w-full max-w-sm prayer-card flex flex-col items-center text-center py-12">
        <h1 className="card-title text-4xl mb-6">THE BEAUTY OF GOD</h1>
        <p className="text-lg leading-relaxed text-black/80 font-medium break-keep">
          가족캠프2 리더<br />
          기도카드 나눔
        </p>

        {isLoading ? (
          <p className="mt-12 text-sm text-black/55" role="status">오늘의 기도카드를 불러오고 있습니다.</p>
        ) : mode === 'error' ? (
          <>
            <p className="mt-10 text-sm leading-relaxed text-red-900/75 break-keep">{message}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-7 px-8 py-3 border-2 border-black text-black font-semibold"
            >
              다시 확인하기
            </button>
          </>
        ) : null}
      </section>
    </main>
  );
}
