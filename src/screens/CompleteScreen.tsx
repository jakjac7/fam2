import { useState } from 'react';

const SHARE_TITLE = '가족캠프2 기도카드';
const SHARE_TEXT = '가족캠프2 리더들을 위한 기도에 함께해주세요.';

function publicPrayerPageUrl() {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString();
}

export default function CompleteScreen({ onPrayMore, name }: { onPrayMore: () => void; name: string }) {
  const [shareStatus, setShareStatus] = useState('');
  const shareUrl = publicPrayerPageUrl();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus('링크를 복사했어요.');
    } catch {
      setShareStatus('링크 복사에 실패했어요. 브라우저 메뉴에서 공유해주세요.');
    }
  };

  const share = async () => {
    if (!navigator.share) {
      await copyLink();
      return;
    }

    try {
      await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: shareUrl });
      setShareStatus('');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      await copyLink();
    }
  };

  const openSocialShare = (service: 'x' | 'facebook') => {
    const targetUrl = service === 'x'
      ? `https://x.com/intent/post?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(shareUrl)}`
      : `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-full max-w-sm prayer-card flex flex-col items-center text-center py-16">
        <h1 className="card-title text-5xl mb-8">AMEN</h1>
        
        <p className="text-lg leading-relaxed text-black/85 font-medium break-keep">
          {name ? `${name}님, ` : ''}세 분의 리더를 위해<br/>
          함께 기도해 주셔서 감사합니다.
        </p>

        <div className="mt-9 w-full border-t border-black/15 pt-7">
          <p className="mb-3 text-sm font-semibold text-black/65">기도로 함께할 분에게 알려주세요</p>
          <button
            type="button"
            onClick={() => void share()}
            className="w-full bg-black py-3.5 text-base font-semibold text-white active:scale-[0.98] transition-transform"
          >
            공유하기
          </button>
          <p className="mt-3 text-xs leading-relaxed text-black/50 break-keep">
            휴대폰에서는 카카오톡·인스타그램 등 설치된 앱을 선택할 수 있어요.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => openSocialShare('x')}
              className="border border-black/25 py-2 text-sm font-semibold text-black/75 active:bg-black/5"
            >
              X
            </button>
            <button
              type="button"
              onClick={() => openSocialShare('facebook')}
              className="border border-black/25 py-2 text-sm font-semibold text-black/75 active:bg-black/5"
            >
              Facebook
            </button>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="border border-black/25 py-2 text-sm font-semibold text-black/75 active:bg-black/5"
            >
              링크 복사
            </button>
          </div>
          {shareStatus && <p className="mt-3 text-xs font-medium text-black/60" role="status">{shareStatus}</p>}
        </div>

        <button
          type="button"
          onClick={onPrayMore}
          className="mt-6 px-6 py-3 border border-black/30 text-black/80 font-semibold tracking-wide active:bg-black/5 transition-colors"
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
