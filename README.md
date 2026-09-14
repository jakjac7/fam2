# 가족캠프2 기도카드

React/Vite로 만든 가족캠프2 리더 중보기도 카드 웹앱입니다.

## GitHub Pages 배포

이 저장소는 `main` 브랜치에 push하면 GitHub Actions가 정적 파일을 빌드해 Pages로 배포합니다.

처음 한 번만 GitHub 저장소의 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정하세요. 그 뒤 `main`에 push하면 **Actions** 탭의 `Deploy GitHub Pages` 실행이 완료된 후 다음 주소에 반영됩니다.

`https://jakjac7.github.io/fam2/`

프로젝트 사이트이므로 Vite의 `base`는 `/fam2/`입니다. 이 값이 없으면 빌드 산출물이 `/assets/...`를 찾게 되어 GitHub Pages에서 빈 화면이 됩니다.

## 로컬 확인

```bash
npm install
npm run lint
npm run build
npm run preview
```
