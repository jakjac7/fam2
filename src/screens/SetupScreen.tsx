export default function SetupScreen() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <section className="w-full max-w-sm prayer-card text-center py-12">
        <h1 className="card-title text-3xl mb-7">SETUP REQUIRED</h1>
        <p className="text-base leading-relaxed text-black/75 break-keep">
          오늘의 기도카드를 준비하고 있습니다.<br />
          운영진이 Firebase 설정을 완료한 뒤 다시 접속해주세요.
        </p>
      </section>
    </main>
  );
}
