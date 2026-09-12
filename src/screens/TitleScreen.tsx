import { getBestPoint } from '../utils/storage'
import { formatPoint } from '../utils/format'

interface Props {
  onStart: () => void
}

export function TitleScreen({ onStart }: Props) {
  const best = getBestPoint()

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-10 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-black tracking-tight">
          ドパガキ
          <br />
          我慢ゲーム
        </h1>
        <p className="text-base font-bold text-fuchsia-300">あなたは、待てますか？</p>
      </div>

      <div className="space-y-1.5 text-sm leading-relaxed text-white/70">
        <p>待つほどポイントが増える……とは限りません。</p>
        <p>好きなタイミングでポイントを確定してください。</p>
      </div>

      <button
        onClick={onStart}
        className="w-full max-w-xs rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-5 text-xl font-black text-white shadow-[0_8px_0_0_rgba(126,34,206,0.8)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(126,34,206,0.8)]"
      >
        我慢を始める
      </button>

      {best > 0 && (
        <p className="text-xs text-white/40">自己ベスト：{formatPoint(best)} pt</p>
      )}
    </div>
  )
}
