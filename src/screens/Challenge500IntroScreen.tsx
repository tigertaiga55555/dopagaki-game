import { useState } from 'react'
import { QuitButton } from '../components/QuitButton'
import { CHALLENGE500_CONFIG } from '../config/challenge500Config'

interface Props {
  onStart: () => void
  onQuit: () => void
}

const PAGE_COUNT = 3

/**
 * Ver.6 Phase 1（再設計版）: 200% PERFECT CLEAR後に表示する「LIMIT BREAK」説明画面。
 * 1画面に全情報を詰め込まず、3ページに分けて段階的に理解させる
 * （ユーザー指示: 初見でルールを理解しにくい密度の高い1画面構成をやめる）。
 *
 * PAGE 1: 核となる下線反転ギミックを、実際の問題表示風のミニ例で視覚的に見せる。
 * PAGE 2: 200〜299/300〜399/400〜499/500%の段階別ルール。
 * PAGE 3: 段階別MISSペナルティ＋「500%に挑戦する」ボタン。
 *
 * 「×やめる」はどのページからでも既存仕様と統一し、押した場合は確認なく即ホームへ戻る
 * （このプレイの結果は記録されない）。500%チャレンジ自体は「500%に挑戦する」を押した
 * 場合のみ開始し、この説明画面を自動で通過することはない。
 */
export function Challenge500IntroScreen({ onStart, onQuit }: Props) {
  const [page, setPage] = useState(0)

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <QuitButton onQuit={onQuit} />

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-4 text-center">
        {page === 0 && <Page1 />}
        {page === 1 && <Page2 />}
        {page === 2 && <Page3 />}
      </div>

      <div className="flex flex-col items-center gap-4 px-6 pb-8">
        <div className="flex items-center gap-2" aria-hidden="true">
          {Array.from({ length: PAGE_COUNT }, (_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === page ? 'w-6 bg-amber-300' : 'w-1.5 bg-white/25'}`} />
          ))}
        </div>
        <p className="text-[11px] font-bold text-white/30">{page + 1} / {PAGE_COUNT}</p>

        {page < PAGE_COUNT - 1 ? (
          <button
            onClick={() => setPage((p) => p + 1)}
            className="w-full max-w-xs rounded-2xl bg-white/10 py-4 text-base font-black text-white active:scale-95"
          >
            次へ
          </button>
        ) : (
          <button
            onClick={onStart}
            className="w-full max-w-xs rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-5 text-lg font-black text-white shadow-[0_8px_0_0_rgba(126,34,206,0.8)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(126,34,206,0.8)]"
          >
            500%に挑戦する
          </button>
        )}
      </div>
    </div>
  )
}

function Page1() {
  return (
    <div className="anim-pop flex flex-col items-center gap-5">
      <p className="text-sm font-black tracking-widest text-amber-300">200% PERFECT CLEAR</p>
      <h1 className="text-3xl font-black leading-tight tracking-tight text-white">
        LIMIT BREAK
        <br />
        <span className="text-xl text-white/70">200%の先へ</span>
      </h1>
      <p className="max-w-xs text-base font-black leading-relaxed text-white">
        下線が引かれた言葉は
        <br />
        反対の意味で読め
      </p>

      <div className="w-full max-w-xs rounded-2xl border border-white/15 bg-white/5 p-4">
        <p className="mb-2 text-[10px] font-bold tracking-widest text-white/40">問題文の例</p>
        <p className="mb-3 text-lg font-black text-white">
          一番 <span className="underline decoration-4 underline-offset-4">大きい</span> 数字を押せ
        </p>
        <div className="flex items-center justify-center gap-2 text-xl font-black text-white/30">
          <span>↓</span>
        </div>
        <p className="mt-3 text-sm font-bold text-emerald-300">実際は「一番小さい数字」を押すのが正解</p>
      </div>

      <p className="max-w-xs text-xs font-bold leading-relaxed text-white/40">
        下線がない言葉は、そのまま文章どおりに読む。
        <br />
        毎回、下線があるかどうかを見極めるのがこのチャレンジの核心。
      </p>
    </div>
  )
}

function Page2() {
  return (
    <div className="anim-pop flex w-full max-w-xs flex-col items-center gap-5">
      <h2 className="text-2xl font-black text-white">段階別ルール</h2>
      <div className="w-full space-y-2.5 text-left">
        <TierRow range="200〜299%" title="下線反転 1箇所" detail="問題文のどこか1箇所だけが反転する（反転なしも混在）" />
        <TierRow range="300〜399%" title="下線反転 最大2箇所" detail="CHECKPOINT 300% — 以後300%を二度と下回らない" highlight />
        <TierRow range="400〜499%" title="複数条件＋下線反転" detail="CHECKPOINT 400% — 以後400%を二度と下回らない" highlight />
        <TierRow range="500%" title="ABSOLUTE CLEAR" detail="完全クリア。ゲーム最高到達点" gold />
      </div>
    </div>
  )
}

function TierRow({ range, title, detail, highlight, gold }: { range: string; title: string; detail: string; highlight?: boolean; gold?: boolean }) {
  return (
    <div className={`rounded-2xl px-4 py-3 ${gold ? 'bg-amber-400/15' : highlight ? 'bg-emerald-400/10' : 'bg-white/5'}`}>
      <div className="flex items-center justify-between">
        <span className={`text-sm font-black ${gold ? 'text-amber-300' : 'text-white'}`}>{range}</span>
        <span className={`text-xs font-bold ${gold ? 'text-amber-200' : 'text-white/60'}`}>{title}</span>
      </div>
      <p className={`mt-1 text-[11px] font-bold ${gold ? 'text-amber-200/80' : highlight ? 'text-emerald-300' : 'text-white/40'}`}>{detail}</p>
    </div>
  )
}

function Page3() {
  return (
    <div className="anim-pop flex w-full max-w-xs flex-col items-center gap-5">
      <h2 className="text-2xl font-black text-white">MISSのルール</h2>
      <div className="w-full space-y-2.5 text-left text-sm font-bold">
        <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
          <span className="text-white">200〜299%</span>
          <span className="text-red-300">MISS −{CHALLENGE500_CONFIG.missPenaltyTier1}%</span>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
          <span className="text-white">300〜399%</span>
          <span className="text-red-300">MISS −{CHALLENGE500_CONFIG.missPenaltyTier2}%</span>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-red-500/15 px-4 py-3">
          <span className="text-white">400〜499%</span>
          <span className="text-red-300">1 MISSで終了・400%へ</span>
        </div>
      </div>
      <p className="max-w-xs text-xs font-bold leading-relaxed text-white/40">
        正解するたびに+{CHALLENGE500_CONFIG.correctGain}%。一度確保したチェックポイントを下回ることは絶対にない。
      </p>
    </div>
  )
}
