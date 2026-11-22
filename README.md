# this or that

둘 중에 뭘 고를지 모르겠을 때, 고민을 올리면 사람들이 대신 골라주는 모바일 웹 서비스입니다.

- 첫 화면은 슬롯머신: 올라온 고민이 무작위로 돌다가 하나에 멈춥니다.
- 왼쪽 탭으로 첫 화면을 바꿀 수 있습니다. "모아서"는 고민카드를 작게 바둑판처럼 깔아 놓고(앞 네 글자만 보임) 눌러서 열어 봅니다. 한 화면에 깔리는 장수는 화면 크기에 따라 달라집니다.
- 투표는 로그인 없이, 글 하나에 한 번만. 고른 뒤에 비율이 실시간으로 보입니다.
- 글쓰기는 카카오 로그인 후. 질문 100자, 보기 두 개(글 40자, 사진, 링크 중에서), 투표 기한은 6시간 또는 하루.
- 한 계정은 24시간 동안 고민을 3개까지 올릴 수 있습니다. 올렸다 지운 글도 횟수에 들어갑니다.
- 고민카드 아래쪽에 글쓴이와 남은 시간이 보입니다.
- 보기마다 링크를 하나 붙일 수 있습니다. 글을 올릴 때 서버가 그 링크의 제목과 대표 사진을 받아 카드에 미리보기로 보여주고, 링크는 투표와 따로 눌러 엽니다.
- 투표한 로그인 사용자는 글마다 댓글을 한 번, 15자까지 남길 수 있습니다. 고칠 수 없고, 지우면 다시 쓸 수 없습니다. 고민 글쓴이는 자기 글의 댓글을 지울 수 있습니다.
- 글마다 공유 링크(`/p/<id>`)가 있고, 내가 올린 글은 `/me`에서 모아 보고 지울 수 있습니다.

## 바로 실행해 보기 (데모 모드)

```bash
npm install
npm run dev
```

환경 변수 없이 실행하면 데모 모드입니다. 샘플 글이 서버 메모리에 들어 있고, "카카오 로그인" 버튼은
체험용 계정으로 로그인됩니다. 서버를 재시작하면 처음 상태로 돌아갑니다.

## 실제 서비스로 연결하기

### 1. Supabase

1. [supabase.com](https://supabase.com)에서 프로젝트를 만듭니다.
2. SQL Editor에 [`supabase/migrations/`](supabase/migrations) 안의 파일을 번호 순서대로(`0001_init.sql`부터 `0006_post_limit.sql`까지) 붙여 넣고 실행합니다.
   테이블, 접근 정책, 투표 함수, 실시간 구독, 사진 저장소가 한 번에 만들어집니다.
3. `.env.example`을 `.env.local`로 복사하고 Project Settings > API Keys의 값을 채웁니다.
   Publishable key(`sb_publishable_...`)와 Secret key(`sb_secret_...`)를 씁니다. 예전 anon · service_role 키는 쓰지 않습니다.

### 2. 카카오 로그인

1. [Kakao Developers](https://developers.kakao.com)에서 애플리케이션을 만듭니다.
2. 카카오 로그인을 켜고, Redirect URI에 `https://<프로젝트 ref>.supabase.co/auth/v1/callback`을 등록합니다.
3. 동의항목에서 닉네임, 프로필 사진, 카카오계정(이메일)을 설정합니다.
   Supabase가 이메일 항목을 기본으로 요청하는데, 이메일 동의는 비즈 앱으로 전환해야 켤 수 있습니다
   (개인 개발자도 전환 가능).
4. Supabase > Authentication > Providers > Kakao를 켜고 REST API 키(Client ID)와 Client Secret을 넣습니다.
5. Supabase > Authentication > URL Configuration의 Redirect URLs에
   `http://localhost:3000/auth/callback`과 배포 주소의 `/auth/callback`을 추가합니다.

### 3. 배포

Vercel에 저장소를 연결하고 `.env.example`의 변수들을 등록하면 됩니다.

## 구조

| 위치 | 내용 |
| --- | --- |
| `src/components/slot.tsx`, `reel.tsx` | 슬롯머신 피드와 릴 |
| `src/components/board.tsx` | 보기 카드, 투표, 결과 막대 |
| `src/lib/live.ts` | 득표수 실시간 구독 (Supabase Realtime) |
| `src/lib/store/` | 데이터 계층. `supabase.ts`(실서비스)와 `memory.ts`(데모) |
| `src/lib/viewer.ts` | 요청자 식별: 로그인 계정, 브라우저 ID 쿠키, IP 해시 |
| `src/app/api/` | 피드, 글, 투표 API |
| `src/proxy.ts` | 브라우저 ID 쿠키 발급, 로그인 세션 갱신 |

## 투표 중복 방지

- 로그인 사용자는 계정, 비회원은 첫 방문 때 발급되는 쿠키(`tot_vid`, HttpOnly)로 구분합니다.
- `(글, 투표자)` 조합이 DB 기본키라 같은 사람이 두 번 투표할 수 없습니다.
- 통신사 망에서는 여러 사람이 IP 하나를 함께 쓰므로 IP로는 차단하지 않고, 같은 IP에서 한 글에 30표까지만 받는
  상한으로 씁니다. IP는 해시로만 저장합니다.
- 쿠키를 지우면 비회원은 다시 투표할 수 있습니다. 로그인 없는 투표에서는 피할 수 없는 한계입니다.
