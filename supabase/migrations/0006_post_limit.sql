-- 한 계정이 최근 24시간 동안 올릴 수 있는 고민을 3개로 제한합니다.
-- 0005_option_links.sql을 실행한 뒤에 실행합니다.
--
-- 글을 지워도 올린 횟수는 줄지 않아야 "올리고 지우고 또 올리기"를 막을 수 있으므로,
-- posts를 세지 않고 올린 기록을 따로 남깁니다. 제한은 트리거에서 걸기 때문에,
-- 앱 서버를 거치지 않고 Supabase에 직접 넣는 경우에도 똑같이 적용됩니다.
-- (숫자 3과 24시간을 바꾸려면 src/lib/types.ts의 POST_DAILY_LIMIT도 같이 바꿉니다.)

create table public.post_log (
  author_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index post_log_author_idx on public.post_log (author_id, created_at desc);

-- 정책 없음: 서버(service role)와 아래 트리거만 접근합니다.
alter table public.post_log enable row level security;

-- 이미 올라와 있는 글도 횟수에 넣습니다.
insert into public.post_log (author_id, created_at)
select author_id, created_at from public.posts where created_at > now() - interval '1 day';

create function public.enforce_post_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recent integer;
begin
  -- 같은 사람이 동시에 여러 개를 올려도 하나씩 차례로 세도록 잠급니다.
  perform pg_advisory_xact_lock(hashtextextended(new.author_id::text, 0));

  delete from public.post_log l
   where l.author_id = new.author_id and l.created_at <= now() - interval '2 days';

  select count(*) into v_recent
    from public.post_log l
   where l.author_id = new.author_id and l.created_at > now() - interval '1 day';

  if v_recent >= 3 then
    raise exception 'post_limit' using hint = '최근 24시간 동안 3개까지만 올릴 수 있습니다.';
  end if;

  insert into public.post_log (author_id) values (new.author_id);
  return new;
end;
$$;

create trigger posts_enforce_limit
  before insert on public.posts
  for each row execute function public.enforce_post_limit();
