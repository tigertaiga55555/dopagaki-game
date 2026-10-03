import { useEffect, useRef, useState } from 'react'
import { QuitButton } from '../components/QuitButton'
import {
  Confetti120Overlay,
  GoldenClearOverlay,
  RainbowShockwaveOverlay,
  Sparkle120Overlay,
  WhiteFlashOverlay,
} from '../components/OverdriveFx'
import { duckAudio } from '../utils/audioContext'
import { sfx } from '../utils/sound'

interface Props {
  onQuit: () => void
  /** 演出が最後まで再生し終わったら呼ばれる。呼び出し元はここで次の画面へ進む。 */
  onComplete: () => void
}

const SILENCE_MS = 300
const BURST_MS = 2700
const TOTAL_MS = SILENCE_MS + BURST_MS

function hapticPulse(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern)
}

/**
 * Ver.6 Phase 1（演出強化版）: 200% PERFECT CLEARの祝福が完全に終わった後、500%
 * チャレンジの説明画面へ入る前に必ず一度だけ挟む「まだ先がある」ムード転換〜
 * LIMIT BREAK解放の演出。FinalTrialScreen（本番の到達経路）とQAプレビュー画面
 * （Challenge500QaPreviewScreen、演出だけを単独で見返すため）の両方から同じ
 * コンポーネントを再利用する——演出を複製しない。
 *
 * 演出強化: 100% DOPA OVERDRIVE演出を正式な基準とし、そこで使われている
 * WhiteFlashOverlay/RainbowShockwaveOverlay/GoldenClearOverlay/Confetti120Overlay/
 * Sparkle120Overlayをそのまま再利用することで「100% OVERDRIVE同等以上」の
 * 画面占有率・発光量を確保する。「200%の先が開いた」ことを視覚（フラッシュ・衝撃波・
 * 紙吹雪・sparkle）・音（limitBreakUnlock、OVERDRIVE級の二段インパクトを含む）・
 * 振動（haptic）のすべてで伝える。
 *
 * 演出の全シーケンス（溜め→SE/振動→黄金爆発）をこのコンポーネント自身が管理し、
 * 再生し終わったらonCompleteを呼ぶだけのシンプルなAPIにしている（呼び出し元は
 * 「いつ次へ進むか」を自前のタイマーで二重管理しなくてよい）。
 */
export function LimitBreakUnlockScreen({ onQuit, onComplete }: Props) {
  const [beat, setBeat] = useState<'silence' | 'burst'>('silence')
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true
    duckAudio(SILENCE_MS, 1)
    const t1 = setTimeout(() => {
      setBeat('burst')
      sfx.limitBreakUnlock()
      hapticPulse([30, 40, 30, 40, 30, 120])
    }, SILENCE_MS)
    const t2 = setTimeout(onComplete, TOTAL_MS)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <QuitButton onQuit={onQuit} />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="anim-pop text-base font-black tracking-widest text-white/60">200%を超えて、</p>
        <p className="anim-pop text-2xl font-black tracking-widest text-white" style={{ animationDelay: '0.15s' }}>
          まだ先がある……
        </p>
      </div>
      {beat === 'burst' && (
        <>
          <WhiteFlashOverlay show />
          <RainbowShockwaveOverlay show />
          <GoldenClearOverlay show percent={200} title="LIMIT BREAK" />
          <Confetti120Overlay show />
          <Sparkle120Overlay show />
        </>
      )}
    </div>
  )
}
