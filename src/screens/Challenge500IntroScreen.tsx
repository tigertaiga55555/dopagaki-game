import { QuitButton } from '../components/QuitButton'
import { ENDLESS_CONFIG } from '../config/endlessConfig'

interface Props {
  onStart: () => void
  onQuit: () => void
}

/**
 * Ver.6 Phase 1: 200% PERFECT CLEAR後に表示する「500%に挑戦」専用説明画面。
 * 200%到達直後に500%チャレンジを自動開始しない（必ずこの画面を経由する）。
 * 「500%に挑戦する」を押した場合のみ200%からチャレンジが開始する。
 * 「×やめる」は既存仕様と統一し、押した場合は確認なく即ホームへ戻る
 * （このプレイの結果は記録されない）。
 */
export function Challenge500IntroScreen({ onStart, onQuit }: Props) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <QuitButton onQuit={onQuit} />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-6 text-center">
        <p className="text-sm font-black tracking-widest text-amber-300">200% PERFECT CLEAR</p>
        <h1 className="text-4xl font-black tracking-tight text-white">500%に挑戦</h1>

        <div className="w-full max-w-xs space-y-2 rounded-2xl bg-white/5 px-5 py-4 text-left text-sm font-bold text-white/80">
          <div className="flex justify-between">
            <span>正解</span>
            <span className="text-emerald-300">+10%</span>
          </div>
          <div className="flex justify-between">
            <span>MISS</span>
            <span className="text-red-300">−50%</span>
          </div>
          <div className="h-px bg-white/10" />
          <div className="flex justify-between">
            <span>300% CHECKPOINT</span>
            <span className="text-white/60">以後300%未満に戻らない</span>
          </div>
          <div className="flex justify-between">
            <span>400% CHECKPOINT</span>
            <span className="text-white/60">以後400%未満に戻らない</span>
          </div>
          <div className="flex justify-between">
            <span>{ENDLESS_CONFIG.clearPercent}% COMPLETE</span>
            <span className="text-amber-300">完全クリア</span>
          </div>
        </div>

        <p className="max-w-xs text-xs font-bold leading-relaxed text-white/50">
          問題文の中で下線が引かれた言葉は、反対の意味で読んでください。
          <br />
          例：「一番 <span className="underline decoration-4 underline-offset-4">大きい</span> 数字を押せ」→ 実際は一番小さい数字を押す
        </p>

        <button
          onClick={onStart}
          className="mt-2 w-full max-w-xs rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-5 text-lg font-black text-white shadow-[0_8px_0_0_rgba(126,34,206,0.8)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(126,34,206,0.8)]"
        >
          500%に挑戦する
        </button>
      </div>
    </div>
  )
}
