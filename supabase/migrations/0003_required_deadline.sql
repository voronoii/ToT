-- 모든 고민에 투표 기한을 둡니다: 6시간 또는 하루, 길어야 하루.
-- 0002_author_name.sql을 실행한 뒤에 실행합니다.

-- 기한이 없거나 하루보다 긴 기존 글은 "쓴 지 하루"로 맞춥니다.
-- (쓴 지 하루가 넘은 글은 이 시점에 마감됩니다.)
update public.posts
   set expires_at = created_at + interval '1 day'
 where expires_at is null
    or expires_at > created_at + interval '1 day';

alter table public.posts
  alter column expires_at set not null;

-- 서버와 DB 시계가 조금 어긋나도 걸리지 않게 5분의 여유를 둡니다.
alter table public.posts
  add constraint posts_deadline_within_a_day
  check (expires_at > created_at and expires_at <= created_at + interval '1 day 5 minutes');
