import { useEffect, useRef, useState } from 'react'
import { AchievementUnlockBanner } from '../components/AchievementUnlockBanner'
import { AdSlot } from '../components/AdSlot'
import { ChallengeInfoModal } from '../components/ChallengeInfoModal'
import { ResultCard } from '../components/ResultCard'
import { AD_RESULT_SCREEN, ADS_ENABLED_V6 } from '../config/ads'
import { FINAL_TRIAL_CONFIG } from '../config/finalTrialConfig'
import { getRetryLabel } from '../config/messagesV4'
import { buildCreateChallengeInput } from '../challenge/createChallengeFromResult'
import { remoteChallengeDataSource } from '../challenge/remoteChallengeDataSource'
import { qaLocalEntitlementRepository } from '../payment/entitlementRepository'
import { buildResultShareUrl } from '../share/resultShareUrl'
import { grantShareRewardIfEligible, localShareRewardRepository, SHARE_REWARD_DAILY_CAP } from '../share/shareRewardRepository'
import { shareResult, shareResultViaWebShare } from '../share/shareResult'
import { trackChallengeCreated, trackResultView, trackShareClick, trackXShareClick, trackXShareRewardGranted } from '../utils/analytics'
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
  const [challengeBusy, setChallengeBusy] = useState(false)
  const [showChallengeInfo, setShowChallengeInfo] = useState(false)
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
   * 次フェーズ（ゲーム機能クローズラウンド、item 97-99）: 「結果を共有」。OSの共有シート
   * （navigator.share）でLINE/メッセージ/AirDrop/メール等へ、結果テキスト＋/s/:id共有URLを
   * 渡す——「𝕏 結果をシェア」（Share reward・X Web Intent）とは完全に独立しており、
   * ここではShare rewardに一切関与しない。ユーザー自身が共有シートをキャンセルした場合は
   * トーストを出さない。
   */
  async function handleShareResult() {
    trackShareClick()
    const shareUrl = buildResultShareUrl(resultId)
    const outcome = await shareResultViaWebShare({ mode: 'rush', percent: result.percent, resultId, shareUrl })
    if (outcome === 'copied') showToast('共有に非対応の環境のため、テキストとURLをコピーしました')
    else if (outcome === 'failed') showToast('共有に失敗しました。もう一度お試しください。')
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

      {/*
        次フェーズ（ゲーム機能クローズラウンド、item 97-99）: 共有エリアを
        ①挑戦状を送る→②𝕏 結果をシェア→③結果を共有、の順に統一した。
        「𝕏 結果をシェア」（Share reward/Heart付与・/s/:id・動的OGP）は完全に現状維持
        ——以下は文言・ロジックとも一切変更していない。
      */}
      {challengeInput && onChallengeSent && (
        <div className="relative w-full max-w-xs">
          <button
            onClick={() => {
              sfx.uiTap()
              handleSendChallenge()
            }}
            disabled={challengeBusy}
            className="w-full rounded-2xl bg-gradient-to-b from-amber-400 to-orange-500 py-3.5 text-sm font-black text-[#2a1200] shadow-[0_5px_0_0_rgba(154,52,18,0.8)] transition-transform active:translate-y-1 active:shadow-[0_1px_0_0_rgba(154,52,18,0.8)] disabled:opacity-60"
          >
            {challengeBusy ? '挑戦状を作成中…' : '⚔️ 挑戦状を送る'}
          </button>
          {/* item 100: ボタン本体の押下範囲と干渉しない位置（右上の外側）に、ごく小さな？アイコン。 */}
          <button
            onClick={() => {
              sfx.uiTap()
              setShowChallengeInfo(true)
            }}
            aria-label="挑戦状とは？"
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-[#1a0e2e] text-[11px] font-black text-white/70 active:scale-90"
          >
            ？
          </button>
        </div>
      )}

      <button
        onClick={() => {
          sfx.uiTap()
          handleShareToX()
        }}
        className="w-full max-w-xs rounded-2xl bg-black py-3.5 text-sm font-black text-white transition-transform active:scale-[0.98]"
      >
        𝕏 結果をシェア{!hasPass && canRewardThisShare && ' ❤️+1'}
      </button>
      {!hasPass && (
        <p className="-mt-1 text-[10px] font-bold text-white/40">
          {canRewardThisShare ? `シェアで+1 Heart（本日あと${Math.max(0, shareRewardRemainingToday)}回）` : '本日のHeart報酬は受取済み'}
        </p>
      )}

      <button
        onClick={() => {
          sfx.uiTap()
          handleShareResult()
        }}
        className="w-full max-w-xs rounded-2xl bg-white/10 py-3 text-sm font-bold text-white transition-transform active:scale-[0.98]"
      >
        結果を共有
      </button>
      {toast && <p className="anim-pop text-center text-xs font-bold text-amber-200/90">{toast}</p>}

      <button
        onClick={() => {
          sfx.uiTap()
          onRetry()
        }}
        className="mt-2 w-full max-w-xs rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-5 text-lg font-black text-white shadow-[0_8px_0_0_rgba(126,34,206,0.8)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(126,34,206,0.8)]"
      >
        {getRetryLabel(result.percent)}
      </button>
      {/* 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 32-34ナビ監査）: 他の結果画面
          （Endless/Challenge/Battle）はいずれも控えめな「ホームへ戻る」を持つのに、
          この画面だけ持っていなかった既存の不整合を、既存の主要CTA（挑戦状/シェア/
          リトライ）を一切押し出さない最後列のテキストリンクとして揃える。 */}
      <button
        onClick={() => {
          sfx.navHome()
          onHome()
        }}
        className="w-full rounded-2xl bg-transparent py-2 text-sm font-bold text-white/50 active:scale-95"
      >
        ホームへ戻る
      </button>

      {ADS_ENABLED_V6 && (
        <AdSlot adTag={AD_RESULT_SCREEN.tag} width={AD_RESULT_SCREEN.width} height={AD_RESULT_SCREEN.height} label={AD_RESULT_SCREEN.slotName} />
      )}

      {showChallengeInfo && <ChallengeInfoModal onClose={() => setShowChallengeInfo(false)} />}
    </div>
  )
}
