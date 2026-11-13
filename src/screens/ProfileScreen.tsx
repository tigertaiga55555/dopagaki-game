import { useEffect } from 'react'
import { BackButton } from '../components/BackButton'
import { ACHIEVEMENT_DEFS } from '../config/achievements'
import { resolveAvatarEmoji } from '../config/profileConfig'
import { TITLE_DEFS_BY_ID } from '../config/titles'
import { trackProfileView } from '../utils/analytics'
import { localPlayerStatsRepository } from '../utils/playerStatsRepository'
import { getProfile } from '../utils/profileStorage'

interface Props {
  onBack: () => void
  onEdit: () => void
  onAchievements: () => void
  onRanking: () => void
  /** Ver.6 Phase 5.3（送った挑戦状一覧）: 自分が作成したChallengeの一覧を開く。 */
  onSentChallenges: () => void
  /** Ver.6 Phase 5.4（実機QA最終修正）: 自分が挑戦したChallengeの一覧を開く。 */
  onParticipatedChallenges: () => void
}

/**
 * Ver.6 Phase 5（Profile/Achievement/Ranking基盤）: ログイン不要のローカルプロフィール画面。
 *
 * 「プレイヤーカード」として気持ちよく見えることを優先しつつ、過度なSNS風にはしない
 * （フォロー/フォロワー等は一切ない）。世界対戦の勝利数・最大連勝は今回まだ実装していない
 * ため、偽の0として主要Statsに表示しない（PlayerStatsがそもそもこの2値を持たない —
 * utils/playerStatsRepository.ts参照）。
 */
export function ProfileScreen({ onBack, onEdit, onAchievements, onRanking, onSentChallenges, onParticipatedChallenges }: Props) {
  const profile = getProfile()
  const stats = localPlayerStatsRepository.getPlayerStats()
  const equippedTitle = profile.equippedTitleId ? TITLE_DEFS_BY_ID[profile.equippedTitleId] : null

  useEffect(() => {
    trackProfileView()
  }, [])

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <BackButton onBack={onBack} label="ホーム" />

      <div className="flex flex-1 flex-col items-center gap-6 px-6 py-4">
        {/* プレイヤーカード */}
        <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-3xl border border-fuchsia-400/20 bg-gradient-to-b from-white/[0.06] to-white/[0.02] px-6 py-6 text-center shadow-[0_0_30px_rgba(217,70,239,0.08)]">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-fuchsia-400/50 bg-fuchsia-500/10 text-4xl shadow-[0_0_20px_rgba(217,70,239,0.3)]">
            {resolveAvatarEmoji(profile.avatar)}
          </div>
          <p className="text-xl font-black text-white">{profile.nickname}</p>
          <p className="text-xs font-bold tracking-widest text-fuchsia-300/90">
            {equippedTitle ? equippedTitle.name : '称号未装備'}
          </p>
          <button
            onClick={onEdit}
            className="mt-1 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-bold text-white/70 active:scale-95"
          >
            プロフィールを編集
          </button>
        </div>

        {/* プレイヤー記録 */}
        <div className="w-full max-w-xs space-y-2 rounded-2xl bg-white/5 px-4 py-4">
          <p className="mb-1 text-[10px] font-black tracking-widest text-white/40">プレイヤー記録</p>
          <StatRow label="最高DOPA%" value={`${stats.maxDopaPercent}%`} />
          <StatRow label="Endless 初級 BEST" value={`${stats.endlessBeginnerBest} STREAK`} />
          <StatRow label="Endless 中級 BEST" value={`${stats.endlessIntermediateBest} STREAK`} />
          <StatRow label="Endless 上級 BEST" value={`${stats.endlessAdvancedBest} STREAK`} />
          <StatRow label="実績解除数" value={`${stats.achievementCount} / ${ACHIEVEMENT_DEFS.length}`} />
          <StatRow label="世界対戦 累計勝利数" value={`${stats.worldBattleWins ?? 0}勝`} />
          <StatRow label="世界対戦 最大連勝" value={`${stats.worldBattleMaxStreak ?? 0}連勝`} />
        </div>

        <div className="flex w-full max-w-xs flex-col gap-3">
          <button
            onClick={onAchievements}
            className="w-full rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-3.5 text-base font-black tracking-widest text-white shadow-[0_6px_0_0_rgba(126,34,206,0.8)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(126,34,206,0.8)]"
          >
            ACHIEVEMENT
          </button>
          <button
            onClick={onRanking}
            className="w-full rounded-2xl border border-white/15 bg-white/5 py-3 text-base font-black tracking-widest text-white/80 active:scale-95"
          >
            RANKING
          </button>
          <button
            onClick={onSentChallenges}
            className="w-full rounded-2xl border border-white/15 bg-white/5 py-3 text-sm font-bold text-white/70 active:scale-95"
          >
            作成したChallenge
          </button>
          <button
            onClick={onParticipatedChallenges}
            className="w-full rounded-2xl border border-white/15 bg-white/5 py-3 text-sm font-bold text-white/70 active:scale-95"
          >
            参加したChallenge
          </button>
        </div>
      </div>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-white/60">{label}</span>
      <span className="font-bold tabular-nums text-white">{value}</span>
    </div>
  )
}
