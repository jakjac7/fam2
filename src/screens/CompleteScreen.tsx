import { useEffect, useState } from 'react';

function createAmenImage(name: string, drawDate: string): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 900;
  const context = canvas.getContext('2d');
  if (!context) return Promise.reject(new Error('이미지 생성에 실패했습니다.'));

  context.fillStyle = '#DDD7CC';
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Keep the original typography proportions while exporting a lighter image
  // that is still crisp enough for a mobile share card.
  context.scale(2 / 3, 2 / 3);
  context.fillStyle = '#F8F2E7';
  context.fillRect(80, 100, 920, 1150);
  context.strokeStyle = '#34322F';
  context.lineWidth = 3;
  context.strokeRect(80, 100, 920, 1150);
  context.globalAlpha = 0.45;
  context.lineWidth = 2;
  context.strokeRect(98, 118, 884, 1114);
  context.globalAlpha = 1;

  context.fillStyle = '#222222';
  context.textAlign = 'center';
  context.font = 'bold 118px Georgia, serif';
  context.fillText('AMEN', 540, 410);

  context.font = '600 48px Pretendard, "Apple SD Gothic Neo", sans-serif';
  context.fillText(`${name || '기도자'}님,`, 540, 570);
  context.font = '500 45px Pretendard, "Apple SD Gothic Neo", sans-serif';
  context.fillText('세 분의 리더를 위해', 540, 655);
  context.fillText('함께 기도했습니다.', 540, 725);

  context.strokeStyle = 'rgba(34, 34, 34, 0.22)';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(270, 835);
  context.lineTo(810, 835);
  context.stroke();

  context.fillStyle = 'rgba(34, 34, 34, 0.55)';
  context.font = '600 24px Pretendard, "Apple SD Gothic Neo", sans-serif';
  context.fillText(drawDate.replaceAll('-', '.'), 540, 920);
  context.fillStyle = 'rgba(34, 34, 34, 0.45)';
  context.font = '600 25px Pretendard, "Apple SD Gothic Neo", sans-serif';
  context.fillText('POD CHURCH', 540, 1090);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('이미지 생성에 실패했습니다.'));
        return;
      }
      resolve(new File([blob], `amen-prayer-${drawDate}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.82);
  });
}

export default function CompleteScreen({
  onPrayMore,
  name,
  drawDate,
}: {
  onPrayMore: () => void;
  name: string;
  drawDate: string;
}) {
  const [shareStatus, setShareStatus] = useState('');
  const [amenImage, setAmenImage] = useState<File | null>(null);
  const [isPreparingImage, setIsPreparingImage] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [downloadImageUrl, setDownloadImageUrl] = useState('');
  const isKakaoTalkInApp = /KAKAOTALK/i.test(navigator.userAgent);

  useEffect(() => () => {
    if (downloadImageUrl) URL.revokeObjectURL(downloadImageUrl);
  }, [downloadImageUrl]);

  // Build the certificate before the tap. In-app browsers can revoke the
  // click's user activation after an async canvas operation, which prevents
  // the native share sheet from receiving the image.
  useEffect(() => {
    let isCurrent = true;
    setAmenImage(null);
    setIsPreparingImage(true);

    void createAmenImage(name, drawDate)
      .then((image) => {
        if (isCurrent) setAmenImage(image);
      })
      .catch(() => {
        if (isCurrent) setShareStatus('인증 이미지를 준비하지 못했습니다. 페이지를 새로고침해 다시 시도해 주세요.');
      })
      .finally(() => {
        if (isCurrent) setIsPreparingImage(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [drawDate, name]);

  const shareAmenImage = async () => {
    if (isPreparingImage || isSharing || !amenImage) return;
    setIsSharing(true);
    setShareStatus('');

    try {
      if (isKakaoTalkInApp) {
        const imageUrl = URL.createObjectURL(amenImage);
        const downloadLink = document.createElement('a');
        downloadLink.href = imageUrl;
        downloadLink.download = amenImage.name;
        downloadLink.style.display = 'none';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();
        setDownloadImageUrl(imageUrl);
        setShareStatus('다운로드를 시작했습니다. 갤러리에 보이지 않으면 아래 이미지를 길게 눌러 저장해 주세요.');
        return;
      }

      const shareData: ShareData = {
        files: [amenImage],
      };

      // Do not preflight with navigator.canShare: some in-app WebViews report
      // false there but still open their native image share sheet. This must
      // stay in the click handler so KakaoTalk receives the image directly.
      if (!navigator.share) {
        setShareStatus('이 브라우저는 이미지 직접 공유를 지원하지 않습니다. 카카오톡 메뉴에서 다른 브라우저로 열어 다시 공유해 주세요.');
        return;
      }

      await navigator.share(shareData);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setShareStatus('이미지 직접 공유를 열지 못했습니다. 카카오톡 메뉴에서 다른 브라우저로 열어 다시 시도해 주세요.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-full max-w-sm prayer-card flex flex-col items-center text-center py-16">
        <p className="mb-5 text-xs font-semibold tracking-[0.16em] text-black/45">{drawDate}</p>
        <h1 className="card-title text-5xl mb-8">AMEN</h1>
        
        <p className="text-lg leading-relaxed text-black/85 font-medium break-keep">
          {name ? `${name}님, ` : ''}세 분의 리더를 위해<br/>
          함께 기도해 주셔서 감사합니다.
        </p>

        <button
          type="button"
          onClick={onPrayMore}
          className="mt-9 px-6 py-3 border border-black/30 text-black/80 font-semibold tracking-wide active:bg-black/5 transition-colors"
        >
          같은 세 분을 다시 기도할게요
        </button>

        <div className="mt-4 w-full">
          <button
            type="button"
            onClick={() => void shareAmenImage()}
            disabled={isPreparingImage || isSharing || !amenImage}
            className="w-full bg-black py-3.5 text-base font-semibold text-white active:scale-[0.98] transition-transform disabled:bg-black/45"
          >
            {isPreparingImage
              ? '인증 이미지를 준비하는 중…'
              : isSharing
                ? isKakaoTalkInApp ? '다운로드를 준비하는 중…' : '공유 창을 여는 중…'
                : isKakaoTalkInApp ? '인증 이미지 다운로드' : '공유할게요'}
          </button>
          <p className="mt-3 text-xs leading-relaxed text-black/50 break-keep">
            {isKakaoTalkInApp
              ? '카카오톡 인앱 브라우저에서는 가벼운 인증 이미지를 다운로드합니다.'
              : '인증 이미지를 바로 공유합니다. 기도카드의 내용·이름은 이미지와 링크 미리보기에 포함하지 않습니다.'}
          </p>
          {shareStatus && <p className="mt-3 text-xs font-medium text-black/60" role="status">{shareStatus}</p>}
          {isKakaoTalkInApp && downloadImageUrl && amenImage && (
            <a
              href={downloadImageUrl}
              download={amenImage.name}
              className="mt-4 block rounded-sm border border-black/15 bg-white/35 p-3"
            >
              <img
                src={downloadImageUrl}
                alt="저장할 인증 이미지"
                className="mx-auto max-h-44 w-auto border border-black/10"
              />
              <span className="mt-2 block text-xs font-medium text-black/60">이미지가 안 보이면 길게 눌러 저장</span>
            </a>
          )}
        </div>

        <div className="mt-12 text-xs tracking-widest font-semibold text-black/40">
          POD CHURCH
        </div>
      </div>
    </div>
  );
}
