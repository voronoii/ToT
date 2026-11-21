-- 댓글: 투표한 로그인 사용자가 포스팅마다 한 번만, 15자 이내로 남깁니다.
-- 고칠 수 없고 지울 수만 있으며, 지운 뒤에는 다시 쓸 수 없습니다.
-- 0003_required_deadline.sql을 실행한 뒤에 실행합니다.
--
-- "한 사람이 한 포스팅에 한 번"은 투표와 같은 단위라서, 따로 테이블을 두지 않고 투표 행에 붙입니다.
-- votes는 서버(service role)만 접근하므로 댓글 읽기·쓰기도 모두 서버를 거칩니다.

alter table public.votes
  add column comment text check (comment is null or char_length(comment) between 1 and 15),
  add column comment_author text check (comment_author is null or char_length(comment_author) between 1 and 40),
  -- 화면에서 댓글을 가리킬 때 쓰는 ID. voter_key(사용자 ID가 들어 있음)를 밖으로 내보내지 않기 위한 것입니다.
  add column comment_id uuid unique,
  -- 댓글을 쓴 시각. 댓글을 지워도 남겨 두어 "다시 쓸 수 없음"의 근거가 됩니다.
  add column commented_at timestamptz,
  -- 댓글은 로그인 사용자('u:<uid>')만 남길 수 있습니다.
  add constraint votes_comment_by_member check (
    comment is null or (commented_at is not null and comment_id is not null and voter_key like 'u:%')
  );

create index votes_comments_idx on public.votes (post_id, commented_at desc) where comment is not null;

-- 한 번 쓴 댓글은 지우는 것만 허용합니다 (수정·재작성 차단).
create function public.guard_comment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.commented_at is not null then
    if new.commented_at is distinct from old.commented_at or new.comment_id is distinct from old.comment_id then
      raise exception '댓글을 쓴 기록은 바꿀 수 없습니다';
    end if;
    if new.comment is not null and new.comment is distinct from old.comment then
      raise exception '댓글은 고치거나 다시 쓸 수 없습니다';
    end if;
  end if;
  return new;
end;
$$;

create trigger votes_guard_comment
  before update on public.votes
  for each row execute function public.guard_comment();
