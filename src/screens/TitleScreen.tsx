import { TITLE_TEXT } from '../config/messagesV2'
import { getBestLowPercent } from '../utils/storage'

interface Props {
  onStart: () => void
}

export function TitleScreen({ onStart }: Props) {
  const bestLow = getBestLowPercent()

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-10 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-black tracking-tight">{TITLE_TEXT.heading}</h1>
        <p className="text-base font-bold text-fuchsia-300">{TITLE_TEXT.subCopy}</p>
      </div>

      <div className="space-y-1.5 text-sm leading-relaxed text-white/70">
        {TITLE_TEXT.lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>

      <button
        onClick={onStart}
        className="w-full max-w-xs rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-5 text-xl font-black text-white shadow-[0_8px_0_0_rgba(126,34,206,0.8)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(126,34,206,0.8)]"
      >
        {TITLE_TEXT.startButton}
      </button>

      {Number.isFinite(bestLow) && <p className="text-xs text-white/40">自己最低ドパガキ度：{bestLow}％</p>}
    </div>
  )
}
