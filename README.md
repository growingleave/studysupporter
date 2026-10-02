# StudySupporter

영어 지문을 읽으며 해석과 단어 뜻/동의어/반의어를 바로 확인하고, 개인 단어장에 모아볼 수 있는 학습용 웹앱입니다.

## 로컬 개발

1. Postgres 연결 문자열을 준비합니다(아래 "Vercel 배포" 단계로 먼저 DB를 만들고 그 연결 문자열을 재사용해도 됩니다).
2. `.env.example`을 복사해 `.env`를 만들고 `DATABASE_URL`, `AUTH_SECRET`을 채웁니다.
   ```bash
   cp .env.example .env
   # AUTH_SECRET은 아래 명령으로 생성한 값을 넣으면 됩니다
   openssl rand -base64 32
   ```
3. 의존성 설치 및 스키마 적용, 시드 데이터 주입:
   ```bash
   npm install
   npx prisma migrate deploy
   npx prisma db seed
   ```
4. 개발 서버 실행:
   ```bash
   npm run dev
   ```
   [http://localhost:3000](http://localhost:3000) 에서 확인합니다.

## Vercel 배포 (GitHub 연동)

이 앱은 로그인과 DB가 필요한 서버 기반 앱이라 GitHub Pages 같은 정적 호스팅에서는 동작하지 않습니다. Vercel + Postgres 조합으로 배포합니다.

1. **GitHub 저장소 Import**: [vercel.com](https://vercel.com) 에서 Add New → Project → 이 저장소(`growingleave/studysupporter`) 선택 → Import.
2. **Postgres 추가**: 프로젝트의 Storage 탭 → Create Database → Postgres 선택. 생성하면 `DATABASE_URL` 환경변수가 프로젝트에 자동으로 주입됩니다.
3. **AUTH_SECRET 등록**: 프로젝트 Settings → Environment Variables에 `AUTH_SECRET`을 추가합니다. 값은 `openssl rand -base64 32`로 새로 생성해서 넣으세요(로컬 개발용과 같은 값이어도 되지만, 프로덕션은 별도로 생성하는 걸 권장합니다).
4. **Deploy**: Deploy 버튼을 누릅니다. 빌드 시 `vercel-build` 스크립트(`prisma migrate deploy && next build`)가 자동 실행되어 DB 테이블이 생성됩니다.
5. **지문 데이터 채우기**: 배포 직후에는 지문이 비어 있습니다. 배포된 사이트에 **로그인한 상태로** 아래 URL을 열면 됩니다(터미널/Node.js 설치 불필요, 별도 비밀번호도 불필요 — 로그인 세션만 있으면 됩니다):
   ```
   https://<project>.vercel.app/api/admin/seed
   ```
   `{"ok":true,"seeded":[1,2,3]}` 같은 응답이 보이면 성공입니다. `prisma/seed/passages/`에 새 지문 JSON을 추가해 배포한 뒤 같은 URL을 다시 열면 새 지문이 반영됩니다(코드를 새로 배포할 때마다 자동으로 재시딩되지는 않습니다 — 지문 추가는 의도적으로 트리거하는 별도 작업입니다).

   (터미널을 선호하면 대신 로컬에서 `DATABASE_URL="<연결 문자열>" npx prisma db seed`를 실행해도 동일합니다.)
6. 완료되면 Vercel이 발급하는 `https://<project>.vercel.app` 링크로 접속할 수 있습니다.

로그인이 안 되는 등 인증 문제가 있으면 `src/auth.ts`의 `trustHost: true` 설정과 `AUTH_SECRET` 환경변수가 제대로 들어갔는지부터 확인하세요.
