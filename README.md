# 가족캠프2 기도카드

React/Vite 프론트엔드, Firebase Hosting, Cloud Functions, 비공개 Cloud Firestore로 구성한 가족캠프2 리더 중보기도 카드 웹앱입니다.

기도카드 원문은 정적 번들에 넣지 않습니다. Firebase Function이 **한국 시간 기준 매일 새로 무작위로 고른 3장**만 반환하며, 모든 방문자는 그날 같은 3장을 봅니다. 브라우저는 Firestore 원본 카드 컬렉션을 직접 읽거나 쓸 수 없습니다.

## 보안 구조

```text
Firebase Hosting → Cloud Function → Firestore
                              └ 오늘의 기도카드 3장만 반환
```

- `firestore.rules`는 모든 브라우저의 Firestore 읽기·쓰기를 거부합니다.
- `getDailyPrayerCards` Function은 한국 시간 날짜별로 3장을 한 번만 추첨합니다.
- 그날 사이트를 방문한 사람은 동일한 3장을 보며, 자정 이후 새 추첨이 시작됩니다.
- 로그인 기능은 사용하지 않습니다. 따라서 하루의 3장은 URL을 아는 모든 방문자가 볼 수 있습니다.

## 최초 설정

### 1. Firebase 프로젝트 및 웹 앱

Firebase Console에서 프로젝트를 만들고 Web App을 등록합니다. 프로젝트 설정의 Firebase SDK 구성값을 GitHub Actions Secrets에 저장합니다.

| Secret 이름 | Firebase Web App 구성값 |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | `appId` |
| `VITE_FIREBASE_FUNCTIONS_REGION` | `asia-northeast3` |

Web App 구성값은 브라우저에 공개되는 식별자입니다. **서비스 계정 JSON, OAuth Client Secret, API 키 제한 해제용 키는 여기에 넣지 않습니다.**

### 2. Functions와 Firestore Rules 배포

Cloud Functions 배포는 Firebase/Google Cloud의 결제 설정을 요구할 수 있습니다. 프로젝트와 비용 계정은 소유자가 직접 선택하세요.

```powershell
npm install --global firebase-tools
Copy-Item .firebaserc.example .firebaserc
# .firebaserc의 YOUR_PROJECT_ID를 실제 프로젝트 ID로 변경
npm --prefix functions install
firebase login
firebase use YOUR_PROJECT_ID
firebase deploy --only functions:prayer-cards,firestore
```

`firestore.rules`가 배포되면 일반 브라우저는 모든 Firestore 문서를 거부당합니다. 카드 접근은 Function만 담당합니다.

### 3. 카드 원문 1회 이전

카드 원문을 공개 Git 저장소에 유지하지 마세요. 로컬에서만 서비스 계정 JSON의 경로를 지정해 이전합니다. JSON 내용이나 경로를 GitHub Secrets, 코드, 채팅에 넣지 않습니다.

```powershell
$env:FIREBASE_PROJECT_ID = "YOUR_PROJECT_ID"
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\safe-path\firebase-service-account.json"
npm run import:prayer-cards
```

먼저 데이터 형식만 확인하려면 다음을 실행합니다.

```powershell
npm run import:prayer-cards -- --dry-run
```

업로드와 로그인 검증을 마친 뒤에만 공개 저장소의 `PrayerCards.md`를 제거하고, 이미 공개된 Git 이력 정리 여부도 결정합니다.

## GitHub Pages 배포

`main`에 push하면 GitHub Actions가 `https://jakjac7.github.io/fam2/`로 배포합니다. 위 Firebase Web App 구성값을 Actions secrets에 넣은 뒤 push하세요.

프로젝트 사이트이므로 Vite의 `base`는 `/fam2/`입니다. 이 값이 없으면 빌드 산출물이 `/assets/...`를 찾아 GitHub Pages에서 빈 화면이 됩니다.

## Firebase Hosting 배포

Firebase Hosting은 `https://fam2-prayer-cards.web.app/`에 배포됩니다. `firebase.json`은 `dist`만 올리고 React 경로는 `index.html`로 되돌립니다.

GitHub Actions 배포에는 Firebase 프로젝트의 배포용 서비스 계정 JSON을 `FIREBASE_SERVICE_ACCOUNT_FAM2_PRAYER_CARDS` Repository Secret으로 추가해야 합니다. 이 키는 서버 권한을 가진 장기 자격 증명이므로 공개 저장소·코드·채팅에 넣지 않습니다. 설정을 마치면 `main` push마다 `.github/workflows/deploy-firebase-hosting.yml`이 Firebase Hosting 라이브 채널에 배포합니다.

Cloud Function과 Firestore 규칙은 비용·권한 변경을 의도치 않게 수행하지 않도록 자동 배포하지 않습니다. `Deploy Firebase Backend` 워크플로를 수동 실행해 배포합니다. 같은 서비스 계정 Secret을 사용합니다.

카드 원문은 GitHub Actions에 올리지 않습니다. Firestore 규칙과 Function 배포를 마친 뒤, 원문이 있는 로컬 환경에서만 `npm run import:prayer-cards`를 한 번 실행합니다. 실행 로그에는 카드 본문을 기록하지 않습니다.

## 로컬 확인

```bash
npm install
npm --prefix functions install
npm run lint
npm run build
npm run preview
```
