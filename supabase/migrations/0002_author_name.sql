-- 고민카드 하단에 글쓴이를 보여주기 위해, 글을 쓸 때의 표시 이름을 포스팅에 함께 남깁니다.
-- 0001_init.sql을 실행한 뒤에 실행합니다. 이 컬럼이 생기기 전에 쓴 글은 이름 없이 보입니다.
alter table public.posts
  add column author_name text check (author_name is null or char_length(author_name) between 1 and 40);
