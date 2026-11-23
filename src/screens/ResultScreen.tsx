import { useEffect, useRef, useState } from 'react'
import { AchievementUnlockBanner } from '../components/AchievementUnlockBanner'
import { AdSlot } from '../components/AdSlot'
import { ResultCard } from '../components/ResultCard'
import { AD_RESULT_SCREEN, ADS_ENABLED_V6 } from '../config/ads'
import { FINAL_TRIAL_CONFIG } from '../config/finalTrialConfig'
import { getRetryLabel } from '../config/messagesV4'
import { buildCreateChallengeInput } from '../challenge/createChallengeFromResult'
import { remoteChallengeDataSource } from '../challenge/remoteChallengeDataSource'
import { qaLocalEntitlementRepository } from '../payment/entitlementRepository'
import { buildResultShareUrl } from '../share/resultShareUrl'
import { grantShareRewardIfEligible, localShareRewardRepository, SHARE_REWARD_DAILY_CAP } from '../share/shareRewardRepository'
import { shareResult } from '../share/shareResult'
import { trackChallengeCreated, trackResultView, trackShareClick, trackXShareClick, trackXShareRewardGranted } from '../utils/analytics'
import { captureResultCardPng, downloadPngBlob } from '../utils/shareImage'
import { copyShareText, shareResultWithImage } from '../utils/share'
import { sfx } from '../utils/sound'
import type { ChallengeRecord } from '../challenge/types'
import type { FinalResultV4 } from '../types'

interface Props {
  result: FinalResultV4
  /**
   * 次フェーズ（ゲーム機能クローズラウンド、item 61-66）: このプレイ1回を一意に表す
   * 共有用ID（App.tsx側でプレイ終了の瞬間に1回だけ生成、同じ結果画面インスタンスが
   * 再マウントしない限り変わらない）。Heart報酬の「1結果につき1回まで」の判定キー
   * であり、かつ共有URL（/s/:resultId）の:id部分そのものでもある。
   */
  resultId: string
  onRetry: () => void
  /** 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 32-34）: 他の結果画面と揃えた「ホームへ戻る」。 */
  onHome: () => void
  /** Ver.6 Phase 5.2（Challenge機能完成）: 「挑戦状を送る」が成功した際に呼ばれる。 */
  onChallengeSent?: (challenge: ChallengeRecord) => void
}

const TOAST_MS = 3200

export function ResultScreen({ result, resultId, onRetry, onHome, onChallengeSent }: Props) {
  const [copied, setCopied] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [challengeBusy, setChallengeBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const newlyUnlocked = result.newlyUnlockedAchievements ?? []
  const challengeInput = buildCreateChallengeInput(result)
  const hasPass = qaLocalEntitlementRepository.hasEntitlement('UNLIMITED_HEART')
  // 次フェーズ（item 61-66）: Heart付与後にボタンの文言（「本日あと◯回」⇄「受取済み」）を
  // 即座に再評価させるための再読み込みトリガー（localStorageはReact stateではないため、
  // dev/PassQaPanel.tsxのsetPassRevisionと同じ方針で値自体は使わず再レンダーのためだけに使う）。
  const [, setShareRewardRevision] = useState(0)
  const canRewardThisShare = !hasPass && localShareRewardRepository.canRewardResult(resultId)
  const shareRewardRemainingToday = SHARE_REWARD_DAILY_CAP - localShareRewardRepository.getDailyShareRewardCount()

  // Ver.5.0追加(TASK C-12): 200%結果画面へ切り替わった瞬間、完全無音にせず
  // bell/sparkle/victory chordのごく控えめな余韻を一度だけ残す。
  useEffect(() => {
    if (result.percent >= FINAL_TRIAL_CONFIG.clearPercent) {
      sfx.resultChime200()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Ver.5.0追加: GA4のresult_viewを結果画面表示のたびに一度だけ送信する。
  useEffect(() => {
    trackResultView(result.percent)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  function showToast(message: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(message)
    toastTimerRef.current = setTimeout(() => setToast(null), TOAST_MS)
  }

  /**
   * Ver.5.0追加: 「画像付きでシェア」。resultデータからCanvas 2Dで共有PNGを直接描画し
   * （shareImage.ts→shareCanvas.ts、DOMキャプチャは経由しない）、Web Share API
   * （ファイル共有対応環境）→テキスト＋URLのみの通常共有→クリップボードコピー＋
   * 画像ダウンロードの順でフォールバックする（share.tsのshareResultWithImage()に集約）。
   * ユーザー自身が共有シートをキャンセルした場合（AbortError）はトーストを出さない。
   */
  async function handleShareImage() {
    if (imageBusy) return
    trackShareClick()
    setImageBusy(true)
    try {
      const blob = await captureResultCardPng(result)
      const outcome = await shareResultWithImage(blob, result.percent, result.type.name, result.finalTrial, result.challenge500)
      if (outcome === 'shared-with-image-ios') {
        showToast('投稿文をコピーしました。必要ならXで貼り付けてください')
      } else if (outcome === 'ios-share-failed-fallback') {
        showToast('直接共有できなかったため、画像を保存して投稿文をコピーしました。')
      } else if (outcome === 'fallback-copied') {
        showToast('画像付き共有に非対応の環境のため、画像を保存し共有文をコピーしました')
      } else if (outcome === 'shared-text-only') {
        showToast('この環境では画像を共有できないため、文章のみ共有しました（画像は「画像を保存」からどうぞ）')
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        showToast('共有に失敗しました。もう一度お試しください。')
      }
    } finally {
      setImageBusy(false)
    }
  }

  /** Ver.5.0追加: 「画像を保存」。共有せず、結果カードのPNGだけを端末へ保存する。 */
  async function handleSaveImage() {
    if (saveBusy) return
    setSaveBusy(true)
    try {
      const blob = await captureResultCardPng(result)
      downloadPngBlob(blob)
      showToast('画像を保存しました')
    } catch {
      showToast('画像の保存に失敗しました。もう一度お試しください。')
    } finally {
      setSaveBusy(false)
    }
  }

  /**
   * 次フェーズ（ゲーム機能クローズラウンド、item 61-66）: 「𝕏 結果をシェア」。
   * Challenge作成（handleSendChallenge）とは完全に独立——どちらを先にやっても後にやっても
   * 互いに一切影響しない（Challenge側はresultIdを一切参照しない）。
   * 共有自体（X Web Intentを開く操作）はPASS所有者・日次上限到達後も常に同じボタンで
   * 行える（ボタンを無効化しない、というユーザー指示）。Heart付与だけが、PASS所有者
   * なら常にスキップ、無料ユーザーでも「このresultIdは既に付与済み」または「本日の上限
   * （2回）に到達済み」ならスキップされる。
   */
  function handleShareToX() {
    trackXShareClick('rush')
    const shareUrl = buildResultShareUrl(resultId)
    shareResult({ mode: 'rush', percent: result.percent, resultId, shareUrl })
    const outcome = grantShareRewardIfEligible(hasPass, resultId)
    if (outcome.granted) trackXShareRewardGranted('rush')
    setShareRewardRevision((r) => r + 1)
  }

  /** 「結果をコピー」は従来通り画像を含めず、共有文＋URLのテキストのみコピーする。 */
  const handleCopy = async () => {
    const ok = await copyShareText(result.percent, result.type.name, result.finalTrial, result.challenge500)
    setCopied(ok)
    if (ok) setTimeout(() => setCopied(false), 2000)
  }

  /**
   * Ver.6 Phase 5.2（Challenge機能完成）: 「挑戦状を送る」。recordedProblemSetが
   * 存在する（＝実際に出題された問題列を記録できた）場合だけボタンを表示する。
   * サーバー（Worker）が実際にDBへ保存した正規のChallengeRecordを受け取ってから
   * onChallengeSentを呼ぶ（クライアント側で先にIDを生成して見せかけたりしない）。
   */
  async function handleSendChallenge() {
    if (challengeBusy || !challengeInput || !onChallengeSent) return
    setChallengeBusy(true)
    try {
      const res = await remoteChallengeDataSource.createChallenge(challengeInput)
      if (res.ok) {
        trackChallengeCreated(challengeInput.mode)
        onChallengeSent(res.value)
      } else {
        showToast('挑戦状の作成に失敗しました。もう一度お試しください。')
      }
    } catch {
      showToast('挑戦状の作成に失敗しました。もう一度お試しください。')
    } finally {
      setChallengeBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center gap-5 px-6 py-8">
      <AchievementUnlockBanner newlyUnlocked={newlyUnlocked} />

      {result.isNewBest && !result.isFirstPlay && (
        <p className="anim-pop rounded-full bg-amber-400/20 px-4 py-1.5 text-sm font-black text-amber-300">
          🎉 自己ベスト更新！
        </p>
      )}

      <ResultCard result={result} />

      {!result.isFirstPlay && (
        <div className="w-full max-w-xs space-y-1 rounded-2xl bg-white/5 px-4 py-3 text-sm">
          <div className="flex justify-between text-white/70">
            <span>今回</span>
            <span className="font-bold tabular-nums text-white">{result.percent}％</span>
          </div>
          <div className="flex justify-between text-white/70">
            <span>自己ベスト</span>
            <span className="font-bold tabular-nums text-white">{result.bestPercent}％</span>
          </div>
        </div>
      )}

      {challengeInput && onChallengeSent && (
        <button
          onClick={handleSendChallenge}
          disabled={challengeBusy}
          className="w-full max-w-xs rounded-2xl bg-gradient-to-b from-amber-400 to-orange-500 py-3.5 text-sm font-black text-[#2a1200] shadow-[0_5px_0_0_rgba(154,52,18,0.8)] transition-transform active:translate-y-1 active:shadow-[0_1px_0_0_rgba(154,52,18,0.8)] disabled:opacity-60"
        >
          {challengeBusy ? '挑戦状を作成中…' : '⚔️ 挑戦状を送る'}
        </button>
      )}

      {/* 次フェーズ（item 61-66）: 「挑戦状を作る」（amber、対戦の誘い）とは意図的に別の
          見た目（黒地＝Xのブランドカラー）にして混同を避ける。ボタン自体は常に活性のまま
          （日次上限到達後も「受取済み」の文言に変わるだけ、無効化はしない）。 */}
      <button
        onClick={handleShareToX}
        className="w-full max-w-xs rounded-2xl bg-black py-3.5 text-sm font-black text-white transition-transform active:scale-[0.98]"
      >
        𝕏 結果をシェア{!hasPass && canRewardThisShare && ' ❤️+1'}
      </button>
      {!hasPass && (
        <p className="-mt-1 text-[10px] font-bold text-white/40">
          {canRewardThisShare ? `シェアで+1 Heart（本日あと${Math.max(0, shareRewardRemainingToday)}回）` : '本日のHeart報酬は受取済み'}
        </p>
      )}

      <div className="w-full max-w-xs space-y-2">
        <button
          onClick={handleShareImage}
          disabled={imageBusy}
          className="w-full rounded-2xl bg-white py-3.5 text-sm font-black text-[#1c1033] transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {imageBusy ? '画像を生成中…' : '🖼️ 画像付きでシェア'}
        </button>
        <button
          onClick={handleSaveImage}
          disabled={saveBusy}
          className="w-full rounded-2xl bg-white/10 py-3 text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {saveBusy ? '画像を生成中…' : '画像を保存'}
        </button>
        <button onClick={handleCopy} className="w-full rounded-2xl bg-white/5 py-2.5 text-xs font-bold text-white/60">
          {copied ? 'コピーしました！' : '結果をコピー'}
        </button>
        {toast && <p className="anim-pop text-center text-xs font-bold text-amber-200/90">{toast}</p>}
      </div>

      <button
        onClick={onRetry}
        className="mt-2 w-full max-w-xs rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-5 text-lg font-black text-white shadow-[0_8px_0_0_rgba(126,34,206,0.8)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(126,34,206,0.8)]"
      >
        {getRetryLabel(result.percent)}
      </button>
      {/* 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 32-34ナビ監査）: 他の結果画面
          （Endless/Challenge/Battle）はいずれも控えめな「ホームへ戻る」を持つのに、
          この画面だけ持っていなかった既存の不整合を、既存の主要CTA（挑戦状/シェア/
          リトライ）を一切押し出さない最後列のテキストリンクとして揃える。 */}
      <button onClick={onHome} className="w-full rounded-2xl bg-transparent py-2 text-sm font-bold text-white/50 active:scale-95">
        ホームへ戻る
      </button>

      {ADS_ENABLED_V6 && (
        <AdSlot adTag={AD_RESULT_SCREEN.tag} width={AD_RESULT_SCREEN.width} height={AD_RESULT_SCREEN.height} label={AD_RESULT_SCREEN.slotName} />
      )}
    </div>
  )
}
