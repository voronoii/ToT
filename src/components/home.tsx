"use client";

import { useSyncExternalStore } from "react";
import { Grid } from "./grid";
import { Slot } from "./slot";

type View = "slot" | "grid";

const STORAGE_KEY = "tot_home_view";
const CHANGED = "tot-home-view";

const VIEWS: { value: View; label: string }[] = [
  { value: "slot", label: "하나씩" },
  { value: "grid", label: "모아서" },
];

/** 마지막으로 고른 보기 방식을 이 브라우저에 기억해 둡니다. 저장소를 못 쓰는 환경에서는 메모리에만 둡니다. */
let remembered: View = "slot";

function read(): View {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "grid" ? "grid" : remembered === "grid" ? "grid" : "slot";
  } catch {
    return remembered;
  }
}

function write(view: View) {
  remembered = view;
  try {
    window.localStorage.setItem(STORAGE_KEY, view);
  } catch {
    // 사생활 보호 모드 등: 이번 방문 동안만 기억합니다.
  }
  window.dispatchEvent(new Event(CHANGED));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** 홈 화면: 고민을 하나씩 뽑아 보거나, 여러 개를 깔아 놓고 골라 봅니다. */
export function Home() {
  // 서버에서는 어떤 보기를 골랐는지 알 수 없으므로, 브라우저에서 읽기 전까지는 내용을 비워 둡니다.
  const view = useSyncExternalStore<View | null>(subscribe, read, () => null);

  return (
    <div className="relative -ml-5 flex flex-1 flex-col pl-[38px]">
      {/* 옷 솔기에 달린 라벨처럼 왼쪽 가장자리에서 삐져나온 탭. 본문보다 넓은 화면에서는 가장자리에 붙지 않으므로 왼쪽도 닫습니다. */}
      <div role="tablist" aria-label="홈 화면 보기 방식" aria-orientation="vertical" className="absolute left-0 top-2.5 flex flex-col gap-2">
        {VIEWS.map((item) => {
          const selected = view === item.value;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => write(item.value)}
              className={`home-tab relative flex h-[84px] w-7 items-center justify-center rounded-r-md border border-l-0 border-dark text-p min-[461px]:rounded-l-md min-[461px]:border-l ${
                selected ? "bg-green font-medium" : "bg-white"
              }`}
            >
              <span className="[writing-mode:vertical-rl]">{item.label}</span>
            </button>
          );
        })}
      </div>

      {view === "slot" && <Slot />}
      {view === "grid" && <Grid />}
    </div>
  );
}
