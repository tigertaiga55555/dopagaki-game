import { useState } from 'react'
import { resolveAvatarEmoji } from '../config/profileConfig'
import { buildChallengeUrl } from '../challenge/url'
import { BASE_DOPA_PERCENT_NOTE, formatAccuracyPercent, formatReactionSeconds } from '../challenge/formatPerformance'
import type { ChallengeRecord } from '../challenge/types'

interface Props {
  challenge: ChallengeRecord
  onDone: () => void
}

const MODE_LABEL: Record<ChallengeRecord['mode'], string> = {
  normal: '通常プレイ',
  finalTrial: 'FINAL DOPA TRIAL',
  challenge500: 'LIMIT BREAK',
}

/**
 * Ver.6 Phase 5.2（Challenge機能完成）: 「挑戦状が完成！」画面。
 * Challenge URLのコピー・共有（Web Share APIがあれば共有シート、無ければコピーへ
 * フォールバック）の両方を用意する。見た目は既存の結果画面・Profile系画面と同じ
 * ダーク＋フクシアのトーンに揃え、ここだけ派手にしすぎない。
 */
export function ChallengeSentScreen({ challenge, onDone }: Props) {
  const [copied, setCopied] = useState(false)
  const url = buildChallengeUrl(challenge.id)

  async function handleShare() {
    const text = `${challenge.creatorNickname}からの挑戦状！${MODE_LABEL[challenge.mode]}で${challenge.creatorScore}％を記録した。この記録を超えてみろ！`
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'ドパガキゲーム 挑戦状', text, url })
        return
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return
        // 共有に失敗した環境はコピーへフォールバックする。
      }
    }
    await handleCopy()
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // クリップボードAPIが使えない環境でも画面上にURLを表示しているため、手動コピーは可能。
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <p className="anim-pop text-2xl font-black tracking-widest text-amber-300">⚔️ 挑戦状が完成！</p>

      <div className="flex w-full max-w-xs flex-col items-center gap-2 rounded-3xl border border-amber-300/25 bg-amber-400/10 px-6 py-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-amber-300/50 bg-amber-500/10 text-3xl">
          {resolveAvatarEmoji(challenge.creatorIcon)}
        </div>
        <p className="text-lg font-black text-white">{challenge.creatorNickname}</p>
        <p className="text-xs font-bold tracking-widest text-amber-200/80">{MODE_LABEL[challenge.mode]}</p>
        <p className="text-3xl font-black tabular-nums text-amber-300">{challenge.creatorScore}％</p>
      </div>

      {challenge.performance && (
        <div className="w-full max-w-xs space-y-1.5 rounded-2xl bg-white/5 px-4 py-4 text-sm">
          <p className="mb-1 text-center text-[10px] font-black tracking-widest text-amber-200/80">
            この記録が挑戦者の比較対象になります
          </p>
          <PerformanceRow label="最終DOPA%" value={`${challenge.performance.finalDopaPercent}%`} />
          <PerformanceRow label="通常獲得DOPA%" value={`${challenge.performance.baseDopaPercent}%`} />
          <PerformanceRow label="正答率" value={formatAccuracyPercent(challenge.performance.accuracy)} />
          <PerformanceRow label="最大COMBO" value={`${challenge.performance.maxCombo}`} />
          <PerformanceRow label="反応速度中央値" value={formatReactionSeconds(challenge.performance.medianCorrectReactionMs)} />
          <p className="pt-0.5 text-center text-[9px] text-white/30">{BASE_DOPA_PERCENT_NOTE}</p>
        </div>
      )}

      <p className="w-full max-w-xs break-all rounded-2xl bg-white/5 px-4 py-3 text-[11px] text-white/50">{url}</p>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          onClick={handleShare}
          className="w-full rounded-2xl bg-gradient-to-b from-amber-400 to-orange-500 py-4 text-base font-black text-[#2a1200] shadow-[0_6px_0_0_rgba(154,52,18,0.8)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(154,52,18,0.8)]"
        >
          共有する
        </button>
        <button onClick={handleCopy} className="w-full rounded-2xl bg-white/10 py-3 text-sm font-bold text-white active:scale-95">
          {copied ? 'コピーしました！' : 'URLをコピー'}
        </button>
        <button onClick={onDone} className="w-full rounded-2xl bg-transparent py-2 text-sm font-bold text-white/50 active:scale-95">
          ホームへ戻る
        </button>
      </div>
    </div>
  )
}

function PerformanceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/60">{label}</span>
      <span className="font-bold tabular-nums text-white">{value}</span>
    </div>
  )
}
