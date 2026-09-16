import { useEffect, useRef, useState } from 'react'
import { getVisualLevelDef } from '../config/visualConfig'
import { MILESTONE_TEXT } from '../config/messagesV4'
import { OVERDRIVE_CONFIG } from '../config/overdriveConfig'
import { getOverdriveTitle } from '../config/resultTypesV4'
import { ResultScreen } from '../screens/ResultScreen'
import { duckAudio, unlockAudio } from '../utils/audioContext'
import { setBgmProgress, setOverdriveMode, startBgm, stopBgm } from '../utils/bgm'
import { isMuted, setMuted, sfx } from '../utils/sound'
import type { FinalResultV4 } from '../types'

/**
 * Vercel Previewでのみ到達できる、DOPA OVERDRIVE演出の一時確認画面。
 *
 * 本番の隠し発動条件（overdriveConfig.ts）やスコア計算（scoreConfigV4.ts）、
 * 実際の60秒ゲームループ（useRushGame.ts）は一切経由しない。かわりに、
 * useRushGame.tsのsetPercentTarget()が100%/OVERDRIVE到達時に行っている演出シーケンス
 * （duckAudio→静寂→sfx.hundred→ゴールドバースト、sfx.overdrive→setOverdriveMode→
 * グリッチバースト）と同じ「本番の関数」をそのまま呼び出し、スクリプトで駆動するだけ。
 * ゲームロジック・条件判定には一切手を加えていない。
 */
const HUNDRED_SILENCE_MS = 300
const BURST_HOLD_MS = 650
const CLIMB_STEP_MS = 700
const CLIMB_TO_98 = [30, 60, 85, 98]
const CLIMB_TO_MAX = [104, 108, 112, 116, OVERDRIVE_CONFIG.maxPercent]

type Phase = 'idle' | 'running' | 'result'

function buildPreviewResult(): FinalResultV4 {
  const finalPercent = OVERDRIVE_CONFIG.maxPercent
  return {
    percent: finalPercent,
    rawPercent: finalPercent,
    overdriveActive: true,
    type: getOverdriveTitle(finalPercent),
    comment: '見てはいけないものを見た気がする。',
    crimeRecords: ['（プレビュー用のダミーデータです）'],
    maxCombo: 24,
    fastestReactionMs: 210,
    accuracy: 0.97,
    isFirstPlay: false,
    isNewBest: false,
    bestPercent: finalPercent,
    playCount: 1,
  }
}

export function OverdrivePreviewScreen() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [displayPercent, setDisplayPercent] = useState(0)
  const [showHundredBurst, setShowHundredBurst] = useState(false)
  const [showOverdriveBurst, setShowOverdriveBurst] = useState(false)
  const [overdriveActive, setOverdriveActive] = useState(false)
  const [muted, setMutedState] = useState(isMuted())
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout)
      stopBgm()
    }
  }, [])

  function schedule(fn: () => void, delayMs: number) {
    timersRef.current.push(setTimeout(fn, delayMs))
  }

  function toggleMute() {
    const next = !muted
    setMuted(next)
    setMutedState(next)
  }

  function start() {
    // iPhone SafariのAudioContext制約に合わせ、本番と同じくユーザー操作の同期コールバック内で呼ぶ。
    unlockAudio()
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setOverdriveMode(false)
    setOverdriveActive(false)
    setShowHundredBurst(false)
    setShowOverdriveBurst(false)
    setDisplayPercent(0)
    setPhase('running')
    startBgm()
    // FINAL相当・高COMBO相当の最も濃いBGMレイヤーを最初から鳴らしておく
    setBgmProgress(5, 20)

    let t = 0
    CLIMB_TO_98.forEach((v, i) => {
      t = 220 * (i + 1)
      schedule(() => setDisplayPercent(v), t)
    })

    // 100%到達演出：本番のsetPercentTarget()と同じ関数呼び出し順（duckAudio→静寂→sfx.hundred）
    const hundredAt = t + 500
    schedule(() => {
      duckAudio(HUNDRED_SILENCE_MS, 1)
      schedule(() => {
        sfx.hundred()
        setDisplayPercent(100)
        setShowHundredBurst(true)
        schedule(() => setShowHundredBurst(false), BURST_HOLD_MS)
      }, HUNDRED_SILENCE_MS)
    }, hundredAt)

    // 100%→101%突破＋DOPA OVERDRIVE演出：本番と同じsfx.overdrive()／setOverdriveMode()を使用
    const overdriveAt = hundredAt + HUNDRED_SILENCE_MS + BURST_HOLD_MS + 400
    schedule(() => {
      sfx.overdrive()
      setOverdriveMode(true)
      setOverdriveActive(true)
      setDisplayPercent(101)
      setShowOverdriveBurst(true)
      schedule(() => setShowOverdriveBurst(false), BURST_HOLD_MS)
    }, overdriveAt)

    // 101% → 120%（本番の上限＝OVERDRIVE_CONFIG.maxPercent）まで段階的に上昇
    const climbStart = overdriveAt + BURST_HOLD_MS + 300
    CLIMB_TO_MAX.forEach((v, i) => {
      schedule(() => {
        setDisplayPercent(v)
        sfx.comboPitchedTier('PERFECT', 20 + i)
      }, climbStart + CLIMB_STEP_MS * i)
    })

    const holdAt = climbStart + CLIMB_STEP_MS * CLIMB_TO_MAX.length + 1800
    schedule(() => {
      stopBgm()
      setPhase('result')
    }, holdAt)
  }

  const visual = getVisualLevelDef(5)
  const frameClass = overdriveActive ? 'intense-frame' : visual.gold ? 'gold-frame' : 'neon-frame'

  if (phase === 'result') {
    return <ResultScreen result={buildPreviewResult()} onRetry={() => setPhase('idle')} />
  }

  return (
    <div className={`relative flex min-h-dvh flex-col items-center overflow-hidden ${frameClass}`}>
      <div className="relative z-30 flex w-full items-center justify-between px-5 pt-3 pb-1">
        <button onClick={toggleMute} className="text-lg opacity-70" aria-label="ミュート切り替え">
          {muted ? '🔇' : '🔊'}
        </button>
        <p className="rounded-full bg-fuchsia-500/20 px-3 py-1 text-[10px] font-black tracking-widest text-fuchsia-300">
          🔧 OVERDRIVE PREVIEW（本番には出ません）
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-[11px] font-bold tracking-widest text-white/50">DOPAGAKI</p>
        <p
          className={`text-7xl font-black tabular-nums drop-shadow-[0_0_20px_rgba(217,70,239,0.5)] ${
            displayPercent > 100 ? 'text-amber-300' : displayPercent >= 100 ? 'text-amber-200' : 'text-white'
          }`}
        >
          {Math.round(displayPercent)}
          <span className="text-3xl">%</span>
        </p>

        {phase === 'idle' && (
          <button
            onClick={start}
            className="mt-6 rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 px-8 py-4 text-base font-black text-white shadow-[0_8px_0_0_rgba(126,34,206,0.8)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(126,34,206,0.8)]"
          >
            ▶ OVERDRIVE演出を再生
          </button>
        )}
        {phase === 'running' && <p className="text-xs font-bold text-white/40">再生中…（音を有効にして確認してください）</p>}
      </div>

      {showHundredBurst && (
        <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/75">
          <div className="anim-gold-burst absolute h-64 w-64 rounded-full bg-amber-300 blur-3xl" />
          <p className="relative whitespace-pre-line text-center text-5xl font-black leading-tight text-amber-300">
            {MILESTONE_TEXT.hundredPercent}
          </p>
          <p className="relative text-lg font-bold text-white">{MILESTONE_TEXT.hundredPercentSub}</p>
        </div>
      )}

      {showOverdriveBurst && (
        <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/85">
          <div className="anim-glitch absolute inset-0 bg-amber-300" />
          <p className="anim-pop relative text-4xl font-black tracking-widest text-amber-300">{MILESTONE_TEXT.overdrive}</p>
        </div>
      )}
    </div>
  )
}
