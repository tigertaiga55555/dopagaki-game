import { useEffect, useRef } from 'react'
import { useInputGateReady } from '../questions/useInputGateReady'
import { sfx } from '../utils/sound'

interface Props {
  limitMs: number
  tier: 1 | 2 | 3
  onTimeout: () => void
}

/** 残り時間がこの値（ms）を下回ったら最初の焦り警告音を鳴らし始める。制限時間自体はlimitMsのまま変わらない。 */
const URGENCY_START_REMAINING_MS = 3000

/** 残り時間（ms）から、焦り警告音の「段階」（0〜3、値が大きいほど切迫）を決める。 */
function urgencyStageFor(remainingMs: number): 0 | 1 | 2 | 3 {
  if (remainingMs > 2000) return 0
  if (remainingMs > 1000) return 1
  if (remainingMs > 500) return 2
  return 3
}

/** 段階ごとの警告音の間隔（ms）。段階が上がるほど短くなる＝テンポが加速する。 */
const URGENCY_PERIOD_MS: Record<0 | 1 | 2 | 3, number> = { 0: 650, 1: 380, 2: 220, 3: 110 }

/**
 * Ver.6 Phase 1（演出強化）: 500%チャレンジの全tier・全問題タイプ共通の制限時間を
 * 可視化するバー。ユーザー指示により「問題の複雑さやtierで制限時間を調整しない」ため、
 * limitMsは呼び出し元（Challenge500Screen）がCHALLENGE500_CONFIG.questionTimeLimitMsを
 * そのまま渡すだけの単一値になる。
 *
 * 演出強化: 既存0〜100%通常ゲームの「残り時間が減るほど音が加速する」終盤10秒の
 * finalRushAlarm（ウーッ、ウーッという上下スイープ、2秒間隔→1秒間隔の2段階加速）と
 * 同じ考え方を、このバーの4.5秒固定ウィンドウに縮小再現する。残り3秒を切った時点から
 * sfx.challenge500Urgencyを自己再スケジュールのsetTimeoutチェーンで鳴らし、残り時間に
 * 応じて650ms→380ms→220ms→110msと間隔を短くする（＝テンポが加速する）。
 * 制限時間そのものの長さ・4.5秒という進行は一切変更しない——鳴らす「間隔」だけを
 * 残り時間から動的に計算しているだけであり、全tier共通で同じタイミングになる
 * （tierはSEの音色レイヤーにのみ影響し、鳴らすタイミングには一切影響しない）。
 *
 * このコンポーネントは問題インスタンスごとにkey={instanceId}で再マウントされる
 * （Challenge500Screen側）ため、正解/MISS/タイムアウトのいずれで問題が解決しても
 * 即座にアンマウント→useEffectのクリーンアップが走り、次の警告音のタイマーが
 * 必ずキャンセルされる（「正解した瞬間に焦り音を即停止」を追加のロジックなしで実現）。
 *
 * 既存の反応速度計測修正（useInputGateReady）と同じ「画面が実際にペイントされるまで
 * 計測を始めない」原則をここでも踏襲し、マウント直後の同期計測による不当な時間切れを防ぐ。
 * 時間切れはonTimeoutを1回だけ呼び（firedRefで多重発火を防止）、呼び出し元がMISS扱いに
 * する。問題側のonPointerDown（タップ判定）とは独立しているが、Challenge500Screen側で
 * 「どちらか先に解決した方だけを採用する」ガードを持つため、タイムアウトと正解判定の
 * 競合は発生しない。
 *
 * 実機フィードバック(Ver.6 Phase 1演出強化の後)により、黄色い横タイマーバー自体が
 * 問題文より目立ちすぎるため視覚表示を廃止した。4.5秒固定の計測・timeout判定・
 * 焦り音(sfx.challenge500Urgency)のスケジューリングはすべてこのコンポーネントの
 * 内部状態としてそのまま残し、見えるUIだけを持たない（残り時間は焦り音の
 * テンポ変化だけで伝える）。
 */
export function Challenge500TimerBar({ limitMs, tier, onTimeout }: Props) {
  const ready = useInputGateReady()
  const firedRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const urgencyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!ready) return
    const startedAt = performance.now()
    function tick() {
      const elapsed = performance.now() - startedAt
      if (elapsed >= limitMs) {
        if (!firedRef.current) {
          firedRef.current = true
          onTimeout()
        }
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  useEffect(() => {
    if (!ready) return
    const startedAt = performance.now()
    function urgencyTick() {
      const remaining = limitMs - (performance.now() - startedAt)
      if (remaining <= 0) return
      const stage = urgencyStageFor(remaining)
      sfx.challenge500Urgency(stage, tier)
      urgencyTimerRef.current = setTimeout(urgencyTick, Math.min(URGENCY_PERIOD_MS[stage], remaining))
    }
    const initialDelay = Math.max(0, limitMs - URGENCY_START_REMAINING_MS)
    urgencyTimerRef.current = setTimeout(urgencyTick, initialDelay)
    return () => {
      if (urgencyTimerRef.current) clearTimeout(urgencyTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tier])

  return null
}
