import { useEffect, useRef, useState } from 'react'
import { Challenge500QaPanel } from '../dev/Challenge500QaPanel'
import { QuitButton } from '../components/QuitButton'
import { ENDLESS_CONFIG } from '../config/endlessConfig'
import type { EndlessState } from '../engine/endlessChallenge'
import { useEndlessChallenge } from '../engine/useEndlessChallenge'
import { ENDLESS_QUESTION_MODULES } from '../questions/endless'

interface Props {
  onFinish: (state: EndlessState) => void
  onQuit: () => void
  /**
   * Preview専用のQA補助モード（既定false）。__DOPAGAKI_PREVIEW_ENABLED__
   * （Productionビルドでは常にリテラルfalseにインライン化される）と合わせて二重に
   * ガードしており、本番のApp.tsx通常プレイ経路からは絶対にtrueを渡さない。
   * trueの場合のみ画面左下にQA操作パネル（％ジャンプ・強制正解/MISS）を表示し、
   * useEndlessChallengeのGA4送信（challenge_500_start/reach_300/400/500）を抑制する。
   * 500〜200%本体のゲームロジック・難易度・問題内容には一切手を加えない。
   */
  qaMode?: boolean
}

const END_FLASH_MS = 900

/**
 * Ver.6 Phase 1: 200〜500%「限界突破チャレンジ」の実プレイ画面。
 * Phase 1では演出の作り込みよりゲームロジックの正確さを優先し、終了時のフラッシュのみ
 * 最小限用意している（詳細な専用演出は今後のフェーズで拡張可能）。
 */
export function Challenge500Screen({ onFinish, onQuit, qaMode = false }: Props) {
  const [finalState, setFinalState] = useState<EndlessState | null>(null)
  const { snapshot, start, handleResult, jumpTo } = useEndlessChallenge((state) => setFinalState(state), { qaMode })
  const startedRef = useRef(false)
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showQaPanel = qaMode && __DOPAGAKI_PREVIEW_ENABLED__

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!finalState) return
    finishTimerRef.current = setTimeout(() => onFinish(finalState), END_FLASH_MS)
    return () => {
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalState])

  const CurrentQuestion = snapshot.currentSpec ? ENDLESS_QUESTION_MODULES.find((m) => m.id === snapshot.currentSpec!.type)?.Component : null

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <QuitButton onQuit={onQuit} />

      <div className="relative z-10 flex items-start justify-between px-5 pt-3 pb-1">
        <p className="text-[10px] font-bold tracking-widest text-white/40">限界突破チャレンジ</p>
        <div className="text-right">
          <p className="text-[10px] font-bold tracking-widest text-white/50">DOPA</p>
          <p className="text-4xl font-black tabular-nums text-amber-300">
            {snapshot.state.percent}
            <span className="text-xl">%</span>
          </p>
        </div>
      </div>

      {snapshot.state.floor > ENDLESS_CONFIG.startPercent && (
        <p className="relative z-10 text-center text-[11px] font-black text-emerald-300">
          CHECKPOINT {snapshot.state.floor}% 確保済み
        </p>
      )}

      <div className="relative z-10 flex flex-1 items-center justify-center">
        {!finalState && CurrentQuestion && snapshot.currentSpec && (
          <div key={snapshot.currentSpec.instanceId} className="h-full w-full">
            <CurrentQuestion spec={snapshot.currentSpec} onResult={handleResult} />
          </div>
        )}
        {finalState && (
          <div className="anim-pop flex flex-col items-center gap-2 text-center">
            {finalState.cleared ? (
              <>
                <p className="text-sm font-black tracking-widest text-amber-300">DOPA 500%</p>
                <p className="text-5xl font-black text-white">ABSOLUTE CLEAR</p>
              </>
            ) : (
              <>
                <p className="text-sm font-black tracking-widest text-white/50">CHALLENGE END</p>
                <p className="text-5xl font-black tabular-nums text-amber-300">{finalState.percent}%</p>
              </>
            )}
          </div>
        )}
      </div>

      {showQaPanel && !finalState && (
        <Challenge500QaPanel
          onJump={jumpTo}
          onForceCorrect={() => handleResult({ correct: true })}
          onForceMiss={() => handleResult({ correct: false })}
        />
      )}
    </div>
  )
}
