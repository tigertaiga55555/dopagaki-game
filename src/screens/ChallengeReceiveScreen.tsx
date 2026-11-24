import { useEffect, useState } from 'react'
import { resolveAvatarEmoji } from '../config/profileConfig'
import { TITLE_DEFS_BY_ID } from '../config/titles'
import { remoteChallengeDataSource } from '../challenge/remoteChallengeDataSource'
import { ENDLESS_DIFFICULTY_LABEL } from '../config/endlessConfig'
import { ENDLESS_THEME } from '../config/endlessTheme'
import { trackChallengeOpened } from '../utils/analytics'
import type { ChallengeApiError, ChallengeRecord } from '../challenge/types'
import type { EndlessDifficulty } from '../types'

interface Props {
  challengeId: string
  onAccept: (challenge: ChallengeRecord) => void
  onHome: () => void
  /** Ver.6 Phase 5.2: 作成者自身の挑戦履歴を見るための導線（作成者が自分のChallengeを開いた場合に表示）。 */
  onViewHistory: (challenge: ChallengeRecord) => void
}

const MODE_LABEL: Record<ChallengeRecord['mode'], string> = {
  normal: '通常プレイ（0〜120%）',
  finalTrial: 'FINAL DOPA TRIAL（120〜200%）',
  challenge500: 'LIMIT BREAK（200〜500%）',
  endless: 'ENDLESS',
}

type LoadState = { status: 'loading' } | { status: 'error'; error: ChallengeApiError } | { status: 'ready'; challenge: ChallengeRecord }

/**
 * Ver.6 Phase 5.2（Challenge機能完成）: Challenge URLを開いた瞬間に表示される受信画面。
 * 「○○からの挑戦状」「この記録を超えろ」という煽り文＋作成者情報＋作成者スコアを表示する。
 * 架空情報は一切使わず、必ずGET /api/challenges/:idで取得した実データだけを表示する
 * （取得できなければ素直にエラー表示する。フォールバックで偽のChallengeを作らない）。
 */
export function ChallengeReceiveScreen({ challengeId, onAccept, onHome, onViewHistory }: Props) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    remoteChallengeDataSource.getChallenge(challengeId).then((res) => {
      if (cancelled) return
      if (res.ok) {
        setState({ status: 'ready', challenge: res.value })
        trackChallengeOpened(res.value.mode)
      } else {
        setState({ status: 'error', error: res.error })
      }
    })
    return () => {
      cancelled = true
    }
  }, [challengeId])

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm font-bold text-white/50">挑戦状を読み込み中…</p>
      </div>
    )
  }

  if (state.status === 'error') {
    const message =
      state.error === 'not_found'
        ? 'この挑戦状は見つかりませんでした。URLが正しいかご確認ください。'
        : state.error === 'not_configured'
          ? 'Challenge機能は現在この環境では利用できません。'
          : '挑戦状の読み込みに失敗しました。通信環境をご確認のうえ、もう一度お試しください。'
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
        <p className="text-sm font-bold text-white/70">{message}</p>
        <button
          onClick={onHome}
          className="rounded-2xl bg-white/10 px-6 py-3 text-sm font-bold text-white active:scale-95"
        >
          ホームへ戻る
        </button>
      </div>
    )
  }

  const { challenge } = state
  const equippedTitle = challenge.creatorEquippedTitle ? TITLE_DEFS_BY_ID[challenge.creatorEquippedTitle] : null
  const isEndless = challenge.mode === 'endless'
  const endlessDifficulty = challenge.conditions.endlessDifficulty as EndlessDifficulty | undefined
  const endlessTheme = endlessDifficulty ? ENDLESS_THEME[endlessDifficulty] : null

  /**
   * 次フェーズ（ゲーム機能クローズラウンド、item 101）: 「対象記録を大きく表示」。
   * nickname取得できる場合だけ主語にする（ChallengeRecord.creatorNicknameは必須項目
   * だが、念のため空文字のような実質未取得ケースでは無理に「のXXを超えろ」という
   * 不自然な文にせず、記録そのものだけを見せる）。
   */
  const targetLine =
    isEndless && endlessDifficulty
      ? challenge.creatorNickname
        ? `${challenge.creatorNickname}の ENDLESS ${ENDLESS_DIFFICULTY_LABEL[endlessDifficulty]} ${challenge.creatorScore} STREAKを超えろ`
        : `ENDLESS ${ENDLESS_DIFFICULTY_LABEL[endlessDifficulty]} ${challenge.creatorScore} STREAKを超えろ`
      : challenge.creatorNickname
        ? `${challenge.creatorNickname}の${challenge.creatorScore}%を超えろ`
        : `${challenge.creatorScore}%を超えろ`

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <p className="text-xl font-black text-white">挑戦状が届きました</p>
      <p className="-mt-4 text-xs font-bold text-white/50">この記録に挑戦するためのモードです。</p>

      <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-3xl border border-fuchsia-400/25 bg-gradient-to-b from-white/[0.06] to-white/[0.02] px-6 py-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-fuchsia-400/50 bg-fuchsia-500/10 text-4xl shadow-[0_0_20px_rgba(217,70,239,0.3)]">
          {resolveAvatarEmoji(challenge.creatorIcon)}
        </div>
        <p className="text-lg font-black text-white">{challenge.creatorNickname}</p>
        {equippedTitle && <p className="text-xs font-bold tracking-widest text-fuchsia-300/90">{equippedTitle.name}</p>}

        {isEndless && endlessDifficulty && endlessTheme ? (
          <>
            <p className="text-[10px] font-black tracking-widest text-white/40">
              ENDLESS ・ {ENDLESS_DIFFICULTY_LABEL[endlessDifficulty]} ・{' '}
              <span className={endlessTheme.textClass}>{endlessTheme.mood}</span>
            </p>
            <p className="text-[10px] font-black tracking-widest text-white/40">TARGET</p>
            <p className={`text-4xl font-black tabular-nums ${endlessTheme.textClass}`}>{challenge.creatorScore}連続</p>
          </>
        ) : (
          <>
            <p className="text-[10px] font-black tracking-widest text-white/40">{MODE_LABEL[challenge.mode]}</p>
            <p className="text-4xl font-black tabular-nums text-amber-300">{challenge.creatorScore}％</p>
          </>
        )}
      </div>

      <p className="w-full max-w-xs text-xl font-black leading-snug tracking-wide text-amber-300">{targetLine}</p>
      <p className="w-full max-w-xs text-[11px] font-bold leading-relaxed text-white/50">
        同じ条件でプレイし、相手の記録を超えれば勝利です。
      </p>

      {isEndless ? (
        <p className="w-full max-w-xs text-[10px] font-bold leading-relaxed text-white/40">
          {challenge.creatorScore + 1}連続正解でWIN　{challenge.creatorScore}連続ならDRAW
        </p>
      ) : (
        challenge.performance && (
          <p className="w-full max-w-xs text-[10px] font-bold leading-relaxed text-white/40">
            最終DOPA%が同じ場合、通常獲得DOPA%→正答率→最大COMBOの順で判定します（完全同値はDRAW）
          </p>
        )
      )}

      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          onClick={() => onAccept(challenge)}
          className="w-full rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-5 text-lg font-black tracking-widest text-white shadow-[0_8px_0_0_rgba(126,34,206,0.8)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(126,34,206,0.8)]"
        >
          挑戦する
        </button>
        <button onClick={() => onViewHistory(challenge)} className="w-full rounded-2xl bg-white/10 py-3 text-sm font-bold text-white active:scale-95">
          挑戦の履歴を見る
        </button>
        <button onClick={onHome} className="w-full rounded-2xl bg-transparent py-2 text-sm font-bold text-white/50 active:scale-95">
          ホームへ戻る
        </button>
      </div>
    </div>
  )
}
