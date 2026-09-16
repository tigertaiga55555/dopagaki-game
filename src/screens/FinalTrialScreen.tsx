import { useEffect, useState } from 'react'
import { computeFinalTrialResult } from '../engine/resultEngineV4'
import { useFinalTrial } from '../engine/useFinalTrial'
import { FINAL_QUESTION_MODULES } from '../questions/final'
import { isMuted, setMuted } from '../utils/sound'
import type { FinalResultV4, PlayStats } from '../types'

interface Props {
  initialStats: PlayStats
  onFinish: (result: FinalResultV4) => void
}

/**
 * Ver.5.0: FINAL DOPA TRIAL専用画面。120%到達後、通常ゲーム（PlayScreen）から完全に
 * 引き継がれる。通常ゲームのグローバル残り時間・OVERDRIVE延長タイマーは一切存在しない
 * （FINALでは全体時計を撤廃、各問題は自分自身のtargetTimeMsだけで判定する）。
 *
 * 突入演出（黒→白フラッシュ→黄金世界が砕ける→プリズム/虹色ショックウェーブ→専用BGM）と
 * 200%到達時の超大型CLEAR演出は今後さらに強化する（現時点は最小限のプレースホルダー）。
 */
const ENTRY_DURATION_MS = 1400

export function FinalTrialScreen({ initialStats, onFinish }: Props) {
  const [entryDone, setEntryDone] = useState(false)
  const [muted, setMutedState] = useState(isMuted())
  const { snapshot, start, handleResult } = useFinalTrial((payload) => {
    onFinish(computeFinalTrialResult(payload, initialStats))
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      setEntryDone(true)
      start()
    }, ENTRY_DURATION_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleMute() {
    const next = !muted
    setMuted(next)
    setMutedState(next)
  }

  const CurrentQuestion = snapshot.currentSpec ? FINAL_QUESTION_MODULES[snapshot.currentSpec.type]?.Component : null

  if (!entryDone) {
    return (
      <div className="relative flex min-h-dvh flex-col items-center justify-center gap-2 bg-black px-6 text-center">
        <p className="anim-pop text-6xl font-black tabular-nums text-amber-300">120%</p>
        <p className="anim-pop text-2xl font-black tracking-widest text-white">OVERDRIVE BREAK</p>
        <div className="anim-pop mt-8 flex flex-col items-center gap-1.5">
          <p className="text-2xl font-black tracking-widest text-fuchsia-300">FINAL DOPA TRIAL</p>
          <p className="text-base font-bold text-white/70">16問連続正解せよ</p>
          <p className="text-base font-black text-red-300">1 MISS = END</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <div className="relative z-30 flex items-start justify-between px-5 pt-3 pb-1">
        <button onClick={toggleMute} className="text-lg opacity-70" aria-label="ミュート切り替え">
          {muted ? '🔇' : '🔊'}
        </button>
        <div className="flex flex-col items-center">
          <p className="text-[10px] font-bold tracking-widest text-white/50">FINAL DOPA TRIAL</p>
          <p className="text-4xl font-black tabular-nums text-amber-300">
            {snapshot.percent}
            <span className="text-xl">%</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold tracking-widest text-white/50">TRIAL</p>
          <p className="text-xl font-black tabular-nums text-white">{Math.min(snapshot.questionNumber, 16)} / 16</p>
        </div>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center">
        {snapshot.phase === 'playing' && CurrentQuestion && snapshot.currentSpec && (
          <div key={snapshot.currentSpec.instanceId} className="h-full w-full">
            <CurrentQuestion spec={snapshot.currentSpec} onResult={handleResult} />
          </div>
        )}
        {snapshot.phase === 'successFlash' && snapshot.milestoneLabel && (
          <p key={snapshot.judgementKey} className="anim-pop text-3xl font-black tracking-widest text-amber-300">
            {snapshot.milestoneLabel}
          </p>
        )}
        {snapshot.phase === 'failed' && (
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="anim-pop text-3xl font-black tracking-widest text-red-400">TRIAL FAILED</p>
            <p className="text-lg font-bold text-white/70">{snapshot.percent}%</p>
          </div>
        )}
        {snapshot.phase === 'clear200' && (
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="anim-pop text-4xl font-black tracking-widest text-amber-300">200%</p>
          </div>
        )}
      </div>
    </div>
  )
}
