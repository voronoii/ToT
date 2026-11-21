"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { api } from "@/lib/client";

type Tile = { id: string; question: string };

const GAP = 15;
/** 이보다 좁아지지 않는 선에서 칸을 가장 많이 넣습니다. */
const MIN_CELL = 90;
/** 아래쪽 버튼(68px)과 그 위아래 여백(40px씩)이 차지하는 높이. */
const RESERVED_BOTTOM = 148;
const MAX_TILES = 20;
/** 작은 카드도 고민카드와 같은 가로로 긴 둥근 사각형입니다 (가로 3 : 세로 2). */
const CELL_RATIO = 2 / 3;

/*
 * 고민 하나를 열어 보고 돌아왔을 때 같은 판이 그대로 있도록, 받은 판과 열어 본 카드를 모듈에 잠시 보관합니다.
 * (화면 사이를 오갈 때는 남고, 새로고침하면 새 판을 받습니다.)
 */
const cache: { tiles: Tile[] | null; opened: Set<string> } = { tiles: null, opened: new Set() };

function keepBoard(tiles: Tile[]): Set<string> {
  cache.tiles = tiles;
  cache.opened = new Set();
  return cache.opened;
}

function keepOpened(id: string): Set<string> {
  cache.opened = new Set(cache.opened).add(id);
  return cache.opened;
}

/** 맨 앞 네 글자만 남깁니다. 띄어쓰기는 글자로 세지 않습니다. */
export function abbreviate(question: string): string {
  const chars = [...question.trim()];
  let letters = 0;
  let end = 0;
  while (end < chars.length && letters < 4) {
    if (chars[end].trim() !== "") letters += 1;
    end += 1;
  }
  const head = chars.slice(0, end).join("");
  return end < chars.length ? `${head}...` : head;
}

/** 꿈틀거림 한 번(위 → 아래 → 위)에 걸리는 시간과, 이웃한 카드 사이의 시간 차. 물결 하나가 카드 네 장에 걸칩니다. */
const WIGGLE_MS = 2800;
const WIGGLE_STEP_MS = WIGGLE_MS / 4;

/*
 * 로고의 꿈틀이처럼, 판 전체가 지그재그로 접힌 한 마리가 되어 물결이 몸을 따라 흘러갑니다.
 * 첫 줄은 왼쪽 → 오른쪽, 다음 줄은 오른쪽 → 왼쪽으로 이어지고, 카드는 물결의 기울기만큼 살짝 기웁니다.
 */
function wiggle(index: number, columns: number): CSSProperties {
  const row = Math.floor(index / columns);
  const column = index % columns;
  const rightward = row % 2 === 0;
  const along = row * columns + (rightward ? column : columns - 1 - column);
  // 음수 지연: 처음부터 물결 중간에서 시작하게 합니다.
  const delay = ((along * WIGGLE_STEP_MS) % WIGGLE_MS) - WIGGLE_MS;
  return {
    "--wiggle-half": `${WIGGLE_MS / 2}ms`,
    "--wiggle-delay": `${delay}ms`,
    "--wiggle-turn": rightward ? -1 : 1,
  } as CSSProperties;
}

/** 화면 크기에 맞춰 몇 칸 × 몇 줄을 깔지 정합니다. */
function useLayout() {
  const ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ columns: number; rows: number } | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      const columns = Math.max(2, Math.floor((rect.width + GAP) / (MIN_CELL + GAP)));
      const cell = ((rect.width - GAP * (columns - 1)) / columns) * CELL_RATIO;
      // 스크롤 없이 한 화면에 들어오는 줄 수. rect.top은 스크롤 위치에 따라 달라지므로 문서 기준으로 잽니다.
      const available = window.innerHeight - (rect.top + window.scrollY) - RESERVED_BOTTOM;
      const fit = Math.max(2, Math.floor((available + GAP) / (cell + GAP)));
      const rows = Math.max(1, Math.min(fit, Math.floor(MAX_TILES / columns)));
      setLayout((current) => (current?.columns === columns && current.rows === rows ? current : { columns, rows }));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return { ref, layout };
}

/** 고민카드를 작게 줄여 바둑판처럼 깔아 놓은 홈 화면. */
export function Grid() {
  const { ref, layout } = useLayout();
  const [tiles, setTiles] = useState<Tile[] | null>(cache.tiles);
  const [opened, setOpened] = useState<Set<string>>(cache.opened);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const run = useRef(0);

  /** 새 판을 받아옵니다. 상태는 응답이 온 뒤에만 바꿉니다. */
  const load = useCallback(() => {
    const id = ++run.current;
    api<{ posts: Tile[] }>("/api/feed/grid")
      .then((data) => {
        if (id !== run.current) return;
        setOpened(keepBoard(data.posts));
        setTiles(data.posts);
        setFailed(false);
      })
      .catch(() => id === run.current && setFailed(true))
      .finally(() => id === run.current && setLoading(false));
  }, []);

  useEffect(() => {
    if (!cache.tiles) load();
  }, [load]);

  const reshuffle = () => {
    setLoading(true);
    load();
  };

  const open = (id: string) => setOpened(keepOpened(id));

  const shown = tiles && layout ? tiles.slice(0, layout.columns * layout.rows) : [];
  const empty = tiles !== null && tiles.length === 0;

  return (
    <div className="flex flex-1 flex-col pt-2.5">
      <h1 className="sr-only">고민 모아 보기</h1>

      <div ref={ref}>
        {failed && <p className="text-p">고민을 불러오지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.</p>}

        {empty && (
          <div className="rounded-lg bg-grey px-[30px] py-10">
            <p className="text-h3">볼 고민이 다 떨어졌어요</p>
            <p className="mt-5 text-p">올라온 고민에 모두 답했습니다. 이번엔 내 고민을 올려 보세요.</p>
          </div>
        )}

        {shown.length > 0 && layout && (
          <ul className="grid gap-[15px]" style={{ gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))` }}>
            {shown.map((tile, index) => {
              const seen = opened.has(tile.id);
              return (
                <li key={tile.id} className="pop-in" style={{ animationDelay: `${index * 25}ms` }}>
                  <Link
                    href={`/p/${tile.id}`}
                    onClick={() => open(tile.id)}
                    aria-label={tile.question}
                    style={wiggle(index, layout.columns)}
                    className={`wiggle flex aspect-[3/2] items-center justify-center rounded-md border border-dark p-2 text-center text-p font-medium ${
                      seen ? "bg-grey text-black" : "on-dark bg-dark text-white"
                    }`}
                  >
                    {abbreviate(tile.question)}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-[15px] pt-10">
        {empty ? (
          <Link href="/new" className="btn btn-primary">
            고민 올리기
          </Link>
        ) : (
          <button type="button" onClick={reshuffle} disabled={loading} className="btn btn-primary">
            {loading ? "불러오는 중" : "다른 고민 보기"}
          </button>
        )}
      </div>
    </div>
  );
}
