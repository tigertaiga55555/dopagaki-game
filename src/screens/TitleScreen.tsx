import { TITLE_TEXT } from '../config/messagesV4'
import { getBestPercent } from '../utils/storage'

interface Props {
  onStart: () => void
}

export function TitleScreen({ onStart }: Props) {
  const best = getBestPercent()

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-10 text-center">
      <h1 className="text-4xl font-black tracking-tight">{TITLE_TEXT.heading}</h1>

      <div className="space-y-3 text-base font-bold leading-relaxed text-white/85">
        {TITLE_TEXT.lines.map((line) => (
          <p key={line} className="whitespace-pre-line">
            {line}
          </p>
        ))}
      </div>

      <button
        onClick={onStart}
        className="w-full max-w-xs rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-6 text-2xl font-black tracking-widest text-white shadow-[0_8px_0_0_rgba(126,34,206,0.8)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(126,34,206,0.8)]"
      >
        {TITLE_TEXT.startButton}
      </button>

      {best > 0 && <p className="text-xs text-white/40">自己ベスト：ドパガキ度 {best}％</p>}
    </div>
  )
}
