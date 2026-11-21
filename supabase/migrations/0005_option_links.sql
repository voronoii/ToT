-- 보기마다 링크를 하나씩 붙일 수 있게 합니다. 글을 올릴 때 서버가 그 링크의 제목과 대표 사진을 한 번 받아 함께 저장합니다.
-- 0004_comments.sql을 실행한 뒤에 실행합니다.

alter table public.posts
  add column a_link text check (a_link is null or (a_link ~ '^https?://' and char_length(a_link) <= 500)),
  add column b_link text check (b_link is null or (b_link ~ '^https?://' and char_length(b_link) <= 500)),
  -- 미리보기: {"title": 제목, "image": 대표 사진 주소}. 링크가 있을 때만 둘 수 있습니다.
  add column a_link_meta jsonb check (
    a_link_meta is null
    or (a_link is not null and jsonb_typeof(a_link_meta) = 'object' and char_length(a_link_meta::text) <= 2000)
  ),
  add column b_link_meta jsonb check (
    b_link_meta is null
    or (b_link is not null and jsonb_typeof(b_link_meta) = 'object' and char_length(b_link_meta::text) <= 2000)
  );

-- 보기는 글, 사진, 링크 중 하나만 있어도 됩니다.
alter table public.posts
  drop constraint posts_a_has_content,
  drop constraint posts_b_has_content,
  add constraint posts_a_has_content check (a_text is not null or a_image is not null or a_link is not null),
  add constraint posts_b_has_content check (b_text is not null or b_image is not null or b_link is not null);
