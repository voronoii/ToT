-- this or that: 초기 스키마
-- Supabase SQL Editor에 그대로 붙여 넣어 실행하거나 `supabase db push`로 적용합니다.

-- ── 포스팅 ──────────────────────────────────────────────────────────────
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  question text not null check (char_length(question) between 1 and 100),
  a_text text check (a_text is null or char_length(a_text) between 1 and 40),
  a_image text, -- storage 경로: <작성자 uid>/<파일명>
  b_text text check (b_text is null or char_length(b_text) between 1 and 40),
  b_image text,
  count_a integer not null default 0,
  count_b integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint posts_a_has_content check (a_text is not null or a_image is not null),
  constraint posts_b_has_content check (b_text is not null or b_image is not null)
);

create index posts_author_idx on public.posts (author_id, created_at desc);

-- ── 투표 ────────────────────────────────────────────────────────────────
-- voter_key: 로그인 사용자는 'u:<uid>', 비회원은 'a:<브라우저 쿠키 ID>'
-- (post_id, voter_key) 기본키가 "한 포스팅에 한 번만" 규칙을 DB 차원에서 보장합니다.
create table public.votes (
  post_id uuid not null references public.posts (id) on delete cascade,
  voter_key text not null,
  choice text not null check (choice in ('a', 'b')),
  ip_hash text,
  created_at timestamptz not null default now(),
  primary key (post_id, voter_key)
);

create index votes_voter_idx on public.votes (voter_key);
create index votes_post_ip_idx on public.votes (post_id, ip_hash);

-- ── 접근 정책 (RLS) ─────────────────────────────────────────────────────
alter table public.posts enable row level security;
alter table public.votes enable row level security;

-- 포스팅은 누구나 읽을 수 있습니다 (실시간 비율 구독에 필요).
create policy "posts are readable by everyone"
  on public.posts for select
  to anon, authenticated
  using (true);

-- 로그인한 사용자만 자기 이름으로, 득표수 0인 상태로, 자기 폴더의 사진만 붙여 글을 쓸 수 있습니다.
create policy "users create their own posts"
  on public.posts for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and count_a = 0
    and count_b = 0
    and (a_image is null or a_image like (select auth.uid())::text || '/%')
    and (b_image is null or b_image like (select auth.uid())::text || '/%')
  );

create policy "users delete their own posts"
  on public.posts for delete
  to authenticated
  using (author_id = (select auth.uid()));

-- update 정책 없음: 득표수는 아래 cast_vote 함수로만 바뀝니다.
-- votes 테이블에는 정책이 없습니다: 서버(service role)만 접근합니다.

-- ── 투표 함수 ───────────────────────────────────────────────────────────
-- 서버(service role)에서만 호출합니다. 포스팅 행을 잠가 동시 투표에도 집계가 어긋나지 않습니다.
create or replace function public.cast_vote(
  p_post_id uuid,
  p_choice text,
  p_voter_key text,
  p_ip_hash text,
  p_ip_limit integer default 30
)
returns table (status text, my_choice text, total_a integer, total_b integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post public.posts%rowtype;
  v_existing text;
  v_ip_votes integer;
begin
  if p_choice not in ('a', 'b') then
    return query select 'invalid'::text, null::text, 0, 0;
    return;
  end if;

  select * into v_post from public.posts p where p.id = p_post_id for update;
  if not found then
    return query select 'not_found'::text, null::text, 0, 0;
    return;
  end if;

  select v.choice into v_existing
    from public.votes v
   where v.post_id = p_post_id and v.voter_key = p_voter_key;
  if v_existing is not null then
    return query select 'already'::text, v_existing, v_post.count_a, v_post.count_b;
    return;
  end if;

  if v_post.expires_at is not null and v_post.expires_at <= now() then
    return query select 'closed'::text, null::text, v_post.count_a, v_post.count_b;
    return;
  end if;

  -- 같은 IP에서 한 포스팅에 몰표를 넣는 것을 막는 상한 (통신사 공유 IP를 고려해 넉넉하게).
  if p_ip_hash is not null then
    select count(*) into v_ip_votes
      from public.votes v
     where v.post_id = p_post_id and v.ip_hash = p_ip_hash;
    if v_ip_votes >= p_ip_limit then
      return query select 'ip_limit'::text, null::text, 0, 0;
      return;
    end if;
  end if;

  insert into public.votes (post_id, voter_key, choice, ip_hash)
  values (p_post_id, p_voter_key, p_choice, p_ip_hash);

  update public.posts p
     set count_a = p.count_a + (case when p_choice = 'a' then 1 else 0 end),
         count_b = p.count_b + (case when p_choice = 'b' then 1 else 0 end)
   where p.id = p_post_id
  returning p.count_a, p.count_b into v_post.count_a, v_post.count_b;

  return query select 'ok'::text, p_choice, v_post.count_a, v_post.count_b;
end;
$$;

-- ── 랜덤 피드 함수 ──────────────────────────────────────────────────────
-- 아직 투표하지 않았고 마감되지 않은 포스팅을 무작위로 돌려줍니다.
create or replace function public.random_posts(
  p_voter_key text,
  p_exclude uuid[] default '{}',
  p_limit integer default 8
)
returns setof public.posts
language sql
stable
security definer
set search_path = ''
as $$
  select p.*
    from public.posts p
   where (p.expires_at is null or p.expires_at > now())
     and p.id <> all (p_exclude)
     and not exists (
       select 1 from public.votes v
        where v.post_id = p.id and v.voter_key = p_voter_key
     )
   order by random()
   limit least(greatest(p_limit, 1), 20);
$$;

revoke all on function public.cast_vote(uuid, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.random_posts(text, uuid[], integer) from public, anon, authenticated;
grant execute on function public.cast_vote(uuid, text, text, text, integer) to service_role;
grant execute on function public.random_posts(text, uuid[], integer) to service_role;

-- ── 실시간 ──────────────────────────────────────────────────────────────
-- posts의 득표수 변경을 브라우저가 실시간으로 구독합니다.
alter publication supabase_realtime add table public.posts;

-- ── 사진 저장소 ─────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('option-images', 'option-images', true, 2097152, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

create policy "users upload option images to their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'option-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users read their own option images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'option-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users delete their own option images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'option-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
