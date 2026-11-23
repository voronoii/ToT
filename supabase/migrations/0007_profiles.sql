-- 사용자가 직접 정하는 닉네임.
-- 0006_post_limit.sql을 실행한 뒤에 실행합니다.
--
-- 닉네임을 정하지 않은 사람은 행이 없고, 그때는 카카오 닉네임을 그대로 씁니다.
-- 닉네임은 겹쳐도 됩니다 (카카오 닉네임도 겹칩니다).
-- 글과 댓글에는 쓸 당시의 이름이 따로 저장되므로, 닉네임을 바꿔도 이미 올린 것의 이름은 그대로입니다.
-- (길이 12를 바꾸려면 src/lib/types.ts의 NICKNAME_MAX도 같이 바꿉니다.)

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (
    char_length(nickname) between 1 and 12
    and nickname = btrim(nickname)
    and nickname !~ '[[:cntrl:]]'
  ),
  updated_at timestamptz not null default now()
);

-- 정책 없음: 서버(secret 키)만 읽고 씁니다. 길이와 글자 검사를 서버 한 곳에서 하기 위해서입니다.
alter table public.profiles enable row level security;
