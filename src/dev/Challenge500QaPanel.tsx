import { useState } from 'react'

interface Props {
  onJump: (percent: number) => void
  onForceCorrect: () => void
  onForceMiss: () => void
}

const JUMP_TARGETS = [200, 300, 400, 490] as const

/**
 * Ver.6 Phase 1 QA補助: Vercel Previewでのみ到達する200〜500%限界突破チャレンジの
 * 実機QA用パネル。既存の仕様（200〜500%の数値ルール・チェックポイント・下線反転の
 * 難易度エスカレーション）には一切変更を加えず、Challenge500Screen（本番の実プレイ画面）
 * の上に操作ボタンを重ねて出すだけの薄いUI。
 *
 * このコンポーネント自体は常にバンドルに含まれるが、呼び出し元
 * （Challenge500Screen.tsx）が__DOPAGAKI_PREVIEW_ENABLED__（Productionビルドでは常に
 * リテラルfalse）とqaMode（本番コードパスからは絶対に渡されない）の両方がtrueの
 * 場合にしかレンダリングしないため、本番では画面に出ることも実行されることもない。
 */
export function Challenge500QaPanel({ onJump, onForceCorrect, onForceMiss }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed bottom-3 left-3 z-[80] flex flex-col items-start gap-2">
      {open && (
        <div className="anim-pop w-56 rounded-xl border border-fuchsia-400/40 bg-black/90 p-3 shadow-xl">
          <p className="mb-2 text-[10px] font-black tracking-widest text-fuchsia-300">QA: ％ジャンプ</p>
          <div className="mb-3 grid grid-cols-4 gap-1.5">
            {JUMP_TARGETS.map((p) => (
              <button
                key={p}
                onClick={() => onJump(p)}
                className="rounded-lg bg-white/10 py-1.5 text-[11px] font-black text-white active:scale-90"
              >
                {p}
              </button>
            ))}
          </div>
          <p className="mb-2 text-[10px] font-black tracking-widest text-fuchsia-300">QA: 現在の問題を即判定</p>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={onForceCorrect}
              className="rounded-lg bg-emerald-500/80 py-1.5 text-[11px] font-black text-white active:scale-90"
            >
              正解 +10%
            </button>
            <button onClick={onForceMiss} className="rounded-lg bg-red-500/80 py-1.5 text-[11px] font-black text-white active:scale-90">
              MISS −50%
            </button>
          </div>
          <p className="mt-2 text-[9px] font-bold leading-tight text-white/40">
            Preview専用。GA4送信・自己ベスト保存は一切行われません。
          </p>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full bg-fuchsia-600/90 px-3 py-1.5 text-[11px] font-black text-white shadow-lg active:scale-90"
      >
        {open ? 'QA ×' : '🔧 QA'}
      </button>
    </div>
  )
}
