import { useState } from 'react';

function createAmenImage(name: string, drawDate: string): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext('2d');
  if (!context) return Promise.reject(new Error('이미지 생성에 실패했습니다.'));

  context.fillStyle = '#DDD7CC';
  context.fillRect(0, 0, canvas.width, canvas.height);
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
      resolve(new File([blob], `amen-prayer-${drawDate}.png`, { type: 'image/png' }));
    }, 'image/png');
  });
}

function downloadImage(image: File) {
  const imageUrl = URL.createObjectURL(image);
  const link = document.createElement('a');
  link.href = imageUrl;
  link.download = image.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(imageUrl), 0);
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
  const [isPreparingImage, setIsPreparingImage] = useState(false);

  const shareAmenImage = async () => {
    if (isPreparingImage) return;
    setIsPreparingImage(true);
    setShareStatus('');

    try {
      const image = await createAmenImage(name, drawDate);
      const shareData: ShareData = { files: [image] };
      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
      } else {
        downloadImage(image);
        setShareStatus('이미지를 저장했어요. 공유 앱에서 이 이미지를 선택해주세요.');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setShareStatus('이미지를 공유하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsPreparingImage(false);
    }
  };

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
          className="mt-9 px-6 py-3 border border-black/30 text-black/80 font-semibold tracking-wide active:bg-black/5 transition-colors"
        >
          같은 세 분을 다시 기도할게요
        </button>

        <div className="mt-4 w-full">
          <button
            type="button"
            onClick={() => void shareAmenImage()}
            disabled={isPreparingImage}
            className="w-full bg-black py-3.5 text-base font-semibold text-white active:scale-[0.98] transition-transform disabled:bg-black/45"
          >
            {isPreparingImage ? '이미지를 준비하는 중…' : '공유할게요'}
          </button>
          <p className="mt-3 text-xs leading-relaxed text-black/50 break-keep">
            기도카드의 내용·이름은 포함하지 않습니다. 휴대폰 공유 메뉴에서 카카오톡, 인스타그램, X, Facebook 등을 선택할 수 있어요.
          </p>
          {shareStatus && <p className="mt-3 text-xs font-medium text-black/60" role="status">{shareStatus}</p>}
        </div>

        <div className="mt-12 text-xs tracking-widest font-semibold text-black/40">
          POD CHURCH
        </div>
      </div>
    </div>
  );
}
