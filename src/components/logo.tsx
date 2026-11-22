/**
 * ToT 로고. 글자가 아니라 꿈틀이 젤리로 그린 그림이고, 그 아래에 작은 워드마크가 붙습니다.
 * 색은 디자인 시스템의 green · dark · white만 씁니다 (this = green, that = dark, or = 둘이 반반).
 */

const BODY = 8; // 젤리 몸통 굵기
const OUTLINE = 11.5; // 몸통 + 양쪽 dark 테두리

/** 몸통 가운데 구간에만 주름을 넣는 dasharray. */
function ridges(start: number, count: number): string {
  return `0 ${start} ${Array.from({ length: count }, () => "1.2").join(" 4 ")} 999`;
}

type WormProps = {
  /** 젤리가 누운 모양. 선 하나가 젤리 한 마리입니다. */
  d: string;
  body: string;
  /** 머리 쪽 색. 꿈틀이처럼 한 마리가 두 가지 색이 됩니다. */
  tip?: string;
  /** 머리 쪽 색이 차지하는 길이 (전체를 100으로 봤을 때). */
  tipLength?: number;
  ridge: string;
  ridgeDash: string;
  /** 윗면에 얹는 윤기. */
  shineDash?: string;
};

function Worm({ d, body, tip, tipLength = 36, ridge, ridgeDash, shineDash }: WormProps) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} className="stroke-dark" strokeWidth={OUTLINE} />
      <path d={d} className={body} strokeWidth={BODY} />
      {tip && <path d={d} className={tip} strokeWidth={BODY} pathLength={100} strokeDasharray={`${tipLength} 100`} />}
      <path d={d} className={ridge} strokeWidth={BODY} strokeLinecap="butt" strokeDasharray={ridgeDash} />
      {shineDash && (
        <path d={d} className="stroke-white" strokeWidth={1.6} strokeDasharray={shineDash} transform="translate(-1.1 -1.5)" />
      )}
    </g>
  );
}

// o: 한 바퀴를 돌고도 조금 더 가서, 머리가 제 꼬리를 덮습니다.
const O_PATH = "M61.75 37 A10 10 0 1 1 61.75 57 A10 10 0 1 1 61.75 37 A10 10 0 0 1 67.49 38.81";

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 123.5 83" className={className} aria-hidden="true">
      {/* T (this): 기둥 한 마리 위에 지붕 한 마리 */}
      <Worm
        d="M30.5 18 q6.5 6.5 0 13 t0 13 t0 13"
        body="stroke-green"
        ridge="stroke-dark"
        ridgeDash={ridges(12, 5)}
        shineDash="0 36.5 4 999"
      />
      <Worm
        d="M8 12 q7.5 -7 15 0 t15 0 t15 0"
        body="stroke-green"
        tip="stroke-white"
        tipLength={30}
        ridge="stroke-dark"
        ridgeDash={ridges(17, 5)}
        shineDash="0 38 7 3 1.5 999"
      />

      {/* o (or): green과 dark가 반반 */}
      <Worm d={O_PATH} body="stroke-dark" tip="stroke-green" tipLength={50} ridge="stroke-dark" ridgeDash={ridges(11, 5)} />
      <g fill="none" strokeLinecap="round">
        <path d={O_PATH} className="stroke-dark" strokeWidth={OUTLINE} strokeDasharray="5 999" />
        <path d={O_PATH} className="stroke-green" strokeWidth={BODY} strokeDasharray="7 999" />
        <path d={O_PATH} className="stroke-white" strokeWidth={1.6} strokeDasharray="0 1 5 999" transform="translate(-0.6 -1.7)" />
      </g>

      {/* T (that) */}
      <Worm d="M93 18 q-6.5 6.5 0 13 t0 13 t0 13" body="stroke-dark" ridge="stroke-green" ridgeDash={ridges(12, 5)} />
      <Worm
        d="M70.5 12 q7.5 7 15 0 t15 0 t15 0"
        body="stroke-dark"
        tip="stroke-green"
        tipLength={30}
        ridge="stroke-green"
        ridgeDash={ridges(19, 5)}
        shineDash="0 2 7 3 1.5 999"
      />

      <text x="61.75" y="80" textAnchor="middle" fontSize="15" fontWeight="500" letterSpacing="-0.2" className="fill-black">
        This or That
      </text>
    </svg>
  );
}
