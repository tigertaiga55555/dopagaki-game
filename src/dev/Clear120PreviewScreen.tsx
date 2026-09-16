import { useEffect, useRef, useState } from 'react'
import { getOverdriveFrameClass, getOverdriveTier, Golden120Overlay, OverdriveAmbience, WhiteFlashOverlay } from '../components/OverdriveFx'
import { OVERDRIVE_CONFIG } from '../config/overdriveConfig'
import { getOverdriveTitle } from '../config/resultTypesV4'
import { ResultScreen } from '../screens/ResultScreen'
import { duckAudio, unlockAudio } from '../utils/audioContext'
import { setBgmProgress, setOverdriveMode, startBgm, stopBgm } from '../utils/bgm'
import { isMuted, setMuted, sfx } from '../utils/sound'
import type { FinalResultV4 } from '../types'

/**
 * Vercel Previewでのみ到達できる、120%到達＝DOPA PERFECT CLEAR演出だけを一時確認する画面。
 *
 * 本番の隠し発動条件（overdriveConfig.ts）やスコア計算（scoreConfigV4.ts）、
 * 実際の60秒ゲームループ（useRushGame.ts）は一切経由しない。かわりに、
 * useRushGame.tsのsetPercentTarget()内のrunMaxClimax()が120%到達時に実行している
 * 演出シーケンス（duckAudio→一瞬の静寂→白閃光(showMaxFlash)→sfx.overdriveMax→
 * 黄金爆発(showMaxBurst)→保持→終了）と全く同じ関数呼び出し順で、
 * 「OVERDRIVE状態(117%)→119%→120%」という数字の推移だけをスクリプトで駆動する。
 * 演出コンポーネント（OverdriveAmbience/WhiteFlashOverlay/Golden120Overlay。
 * いずれも src/components/OverdriveFx.tsx ）・SE（sfx.overdriveMax）・
 * 結果画面（ResultScreen→ResultCard）は、実ゲームで120%に到達した際に
 * PlayScreen/useRushGame.tsが呼ぶのと同じものをそのまま呼び出す。
 * ゲームロジック・条件判定には一切手を加えていない。
 */
const MAX_SILENCE_MS = 250
const WHITE_FLASH_HOLD_MS = 180
const MAX_BURST_HOLD_MS = 1300
/** OVERDRIVE状態であることを一瞬見せてから119%へ進めるまでの間 */
const OVERDRIVE_ESTABLISH_MS = 700
/** 119%を一瞬保持してから120%クライマックスへ入るまでの間 */
const NINETEEN_HOLD_MS = 700
/** OVERDRIVE状態の開始値（見た目上すでにOVERDRIVE中であることが分かるtier3の値） */
const OVERDRIVE_START_PERCENT = 117

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
    maxCombo: 30,
    fastestReactionMs: 190,
    accuracy: 1,
    isFirstPlay: false,
    isNewBest: false,
    bestPercent: finalPercent,
    playCount: 1,
  }
}

export function Clear120PreviewScreen() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [displayPercent, setDisplayPercent] = useState(OVERDRIVE_START_PERCENT)
  const [showMaxFlash, setShowMaxFlash] = useState(false)
  const [showMaxBurst, setShowMaxBurst] = useState(false)
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
    // ここから先（119%→120%→CLEAR結果画面まで）は一切追加操作なしで自動再生する。
    unlockAudio()
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setOverdriveMode(true)
    setShowMaxFlash(false)
    setShowMaxBurst(false)
    setDisplayPercent(OVERDRIVE_START_PERCENT)
    setPhase('running')
    startBgm()
    // FINAL相当・高COMBO相当の最も濃いBGMレイヤーを最初から鳴らしておく（既にOVERDRIVE中の体）
    setBgmProgress(5, 24)

    // OVERDRIVE状態を一瞬見せてから119%へ
    schedule(() => setDisplayPercent(119), OVERDRIVE_ESTABLISH_MS)

    // 120%到達演出：本番のrunMaxClimax()と全く同じ関数呼び出し順
    // （duckAudio→静寂→showMaxFlash→sfx.overdriveMax→showMaxBurst→保持→終了）
    const maxAt = OVERDRIVE_ESTABLISH_MS + NINETEEN_HOLD_MS
    schedule(() => {
      duckAudio(MAX_SILENCE_MS, 1)
      schedule(() => {
        setDisplayPercent(OVERDRIVE_CONFIG.maxPercent)
        setShowMaxFlash(true)
        schedule(() => {
          sfx.overdriveMax()
          setShowMaxFlash(false)
          setShowMaxBurst(true)
          schedule(() => {
            setShowMaxBurst(false)
            stopBgm()
            setPhase('result')
          }, MAX_BURST_HOLD_MS)
        }, WHITE_FLASH_HOLD_MS)
      }, MAX_SILENCE_MS)
    }, maxAt)
  }

  const overdriveTier = getOverdriveTier(displayPercent)
  const frameClass = getOverdriveFrameClass(overdriveTier) || 'neon-frame'

  if (phase === 'result') {
    return <ResultScreen result={buildPreviewResult()} onRetry={() => setPhase('idle')} />
  }

  return (
    <div className={`relative flex min-h-dvh flex-col items-center overflow-hidden ${frameClass}`}>
      <OverdriveAmbience tier={overdriveTier} />

      <div className="relative z-30 flex w-full items-center justify-between px-5 pt-3 pb-1">
        <button onClick={toggleMute} className="text-lg opacity-70" aria-label="ミュート切り替え">
          {muted ? '🔇' : '🔊'}
        </button>
        <p className="rounded-full bg-amber-400/20 px-3 py-1 text-[10px] font-black tracking-widest text-amber-300">
          🔧 120% CLEAR PREVIEW（本番には出ません）
        </p>
      </div>

      <div className="relative z-30 flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-[11px] font-bold tracking-widest text-white/50">DOPAGAKI</p>
        <p className="text-7xl font-black tabular-nums text-amber-300 drop-shadow-[0_0_20px_rgba(250,204,21,0.6)]">
          {Math.round(displayPercent)}
          <span className="text-3xl">%</span>
        </p>

        {phase === 'idle' && (
          <button
            onClick={start}
            className="mt-6 rounded-2xl bg-gradient-to-b from-amber-400 to-amber-600 px-8 py-4 text-base font-black text-white shadow-[0_8px_0_0_rgba(180,83,9,0.8)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(180,83,9,0.8)]"
          >
            ▶ 120% CLEAR演出を再生
          </button>
        )}
        {phase === 'running' && <p className="text-xs font-bold text-white/40">再生中…（音を有効にして確認してください）</p>}
      </div>

      <WhiteFlashOverlay show={showMaxFlash} />
      <Golden120Overlay show={showMaxBurst} title={getOverdriveTitle(OVERDRIVE_CONFIG.maxPercent).name} />
    </div>
  )
}
