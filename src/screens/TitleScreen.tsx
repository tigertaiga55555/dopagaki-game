import { AdSlot } from '../components/AdSlot'
import { AD_START_SCREEN } from '../config/ads'
import { TITLE_TEXT } from '../config/messagesV4'
import { getBestPercent } from '../utils/storage'

interface Props {
  onStart: () => void
  /** Ver.6 Phase 4: Endless難易度選択画面への入口。 */
  onStartEndless: () => void
}

export function TitleScreen({ onStart, onStartEndless }: Props) {
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

      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          onClick={onStart}
          className="w-full rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-6 text-2xl font-black tracking-widest text-white shadow-[0_8px_0_0_rgba(126,34,206,0.8)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(126,34,206,0.8)]"
        >
          {TITLE_TEXT.startButton}
        </button>

        {/* Ver.6 Phase 4: 新モードENDLESSへの入口。メインのSTARTボタンより明確に控えめな
            見た目にし、既存のホーム画面レイアウト・世界観を歪めない。 */}
        <button
          onClick={onStartEndless}
          className="w-full rounded-2xl border border-white/15 bg-white/5 py-3 text-base font-black tracking-widest text-white/80 transition-transform active:scale-95"
        >
          ENDLESS
        </button>
      </div>

      {best > 0 && <p className="text-xs text-white/40">自己ベスト：ドパガキ度 {best}％</p>}

      <AdSlot adTag={AD_START_SCREEN.tag} width={AD_START_SCREEN.width} height={AD_START_SCREEN.height} label={AD_START_SCREEN.slotName} />
    </div>
  )
}
