import { useEffect, useState } from 'react'
import { NavBar } from '../components/NavBar'
import { DopaPassBadge } from '../components/DopaPassBadge'
import { PassTitleBadge } from '../components/PassTitleBadge'
import { PassTitleDetailModal } from '../components/PassTitleDetailModal'
import { SubTitleBadge } from '../components/SubTitleBadge'
import { TitleBadge } from '../components/TitleBadge'
import { TitleDetailModal } from '../components/TitleDetailModal'
import { ACHIEVEMENT_DEFS, getAchievementDefById } from '../config/achievements'
import { PASS_TITLE_DEFS_BY_ID } from '../config/passTitles'
import { resolveAvatarEmoji } from '../config/profileConfig'
import { TITLE_DEFS_BY_ID } from '../config/titles'
import { composeCardFlourish, getSecretTheme, getTitleRarityTheme } from '../config/titleRarityTheme'
import { qaLocalEntitlementRepository } from '../payment/entitlementRepository'
import { getOwnedPassTitleIds, isPassTitleOwned } from '../payment/passTitleGrants'
import { trackProfileView } from '../utils/analytics'
import { localPlayerStatsRepository } from '../utils/playerStatsRepository'
import { equipTitle, getProfile } from '../utils/profileStorage'
import { sfx } from '../utils/sound'
import type { TitleId } from '../types'

interface Props {
  onBack: () => void
  onHome: () => void
  onEdit: () => void
  onAchievements: () => void
  onRanking: () => void
  /** Ver.6 Phase 5.3（送った挑戦状一覧）: 自分が作成したChallengeの一覧を開く。 */
  onSentChallenges: () => void
  /** Ver.6 Phase 5.4（実機QA最終修正）: 自分が挑戦したChallengeの一覧を開く。 */
  onParticipatedChallenges: () => void
  /** 次フェーズ（DOPA PASS基盤ラウンド）: PASS限定の詳細分析画面を開く（PASS所有者のみ導線を出す）。 */
  onOpenPassAnalytics: () => void
  /** 次フェーズ（DOPA PASS基盤ラウンド）: PASS購入画面を開く（非所有者向け）。 */
  onOpenPassPaywall: () => void
}

/**
 * Ver.6 Phase 5（Profile/Achievement/Ranking基盤）: ログイン不要のローカルプロフィール画面。
 *
 * 次フェーズ（DOPA PASS基盤ラウンド、item 29/30）: DOPA PASS所有バッジ（汎用、Profile限定
 * スコープ）・PASS限定Title（通常の装備中Titleとは別枠、装備も可能）・お気に入りTitle
 * （PASS所有者のみ編集可）をこの画面にだけ追加する——ユーザー自身の仕様が「将来
 * VS/Ranking/Challengeへも表示可能」としつつ「Profile画面のみで今回は十分」と明記している
 * ため、他画面への配置は意図的にスコープ外のまま。
 */
export function ProfileScreen({
  onBack,
  onHome,
  onEdit,
  onAchievements,
  onRanking,
  onSentChallenges,
  onParticipatedChallenges,
  onOpenPassAnalytics,
  onOpenPassPaywall,
}: Props) {
  const [profile, setProfile] = useState(() => getProfile())
  const stats = localPlayerStatsRepository.getPlayerStats()
  const hasPass = qaLocalEntitlementRepository.hasEntitlement('DOPA_PASS')
  const ownedPassTitleIds = getOwnedPassTitleIds()

  const equippedPassTitle = profile.equippedTitleId ? PASS_TITLE_DEFS_BY_ID[profile.equippedTitleId] : null
  const equippedRegularTitle = !equippedPassTitle && profile.equippedTitleId ? TITLE_DEFS_BY_ID[profile.equippedTitleId] : null
  /**
   * 次フェーズ（ゲーム機能クローズラウンド、item 89）: Profile画面ではTitle（メイン/
   * サブ1/サブ2のどれでも）は「見るだけ」。タップすると常にこの詳細モーダル（説明・
   * 獲得条件）だけを開き、装備/取り外し/枠変更は一切できない——それらはAchievement
   * 画面（TitleSlotPickerModal）だけの役割にする、というユーザー指示どおり。
   * ここで保持するのは「今詳細を見ているTitleId」だけで、どの枠から開いたかは問わない。
   */
  const [detailTitleId, setDetailTitleId] = useState<TitleId | null>(null)
  const detailPassTitle = detailTitleId ? PASS_TITLE_DEFS_BY_ID[detailTitleId] : null
  const detailRegularTitle = detailTitleId && !detailPassTitle ? TITLE_DEFS_BY_ID[detailTitleId] : null

  // 次フェーズ（item 12）: LEGENDARY/MYTHICを装備している間だけ、アバターリング/
  // プレイヤーカードへ軽くレアリティのテーマ色を広げる（COMMON/RARE/EPICは従来の見た目の
  // ままにし、全体を過剰に色付けしない——ユーザー指示）。PASS限定Title装備時はamber系で統一。
  // 次フェーズ（item 123-124）: SECRET装備時はMYTHICの虹リングではなく、専用の藍リング
  // （getSecretTheme().profileRingClass）にする——「SECRETはMYTHICと別演出」というユーザー指示。
  const equippedIsSecret = equippedRegularTitle ? getAchievementDefById(equippedRegularTitle.id)?.secret === true : false
  const titleFlourishClass = equippedPassTitle
    ? 'border-amber-400/60 shadow-[0_0_24px_rgba(251,191,36,0.3)]'
    : equippedRegularTitle
      ? equippedIsSecret
        ? getSecretTheme().profileRingClass
        : getTitleRarityTheme(equippedRegularTitle.rarity).profileRingClass
      : ''

  /**
   * 次フェーズ（FRIENDS/TABLE/ナビ追加調整ラウンド、item 52→item 159で刷新）: DOPA PASS
   * 所有の表現を、画面中央の大きな「👑 DOPA PASS」バッジ（視線の主役を奪っていた）から、
   * ①カード全体を囲む薄い金のボーダー/グロー＋②カード上端に乗る小さなバッジ、の2点へ
   * 置き換えた。②の小さな上端バッジは、Titleの装飾の有無に関わらず常に表示する
   * （PASS所有という事実そのものが隠れてしまうことは絶対に無いようにする）。
   *
   * item 159: ①について、過去（コミット9f5c0b9時点から一貫した設計）はLEGENDARY/MYTHIC
   * 等のTitle装飾がある場合、PASSの金装飾を完全に消す「排他（OR）」ロジックだった。
   * 紫系のTitle装飾（特にMYTHICの虹）に寄って見えると感じたユーザーの要望により、
   * 「排他ではなく併存」へ変更する——紫の世界観（Titleの装飾）を維持しつつ、PASSなら
   * 常にゴールド系の枠線・光沢を追加する（完全な黄色ベタ枠ではなく、紫×ゴールドの
   * 高級感）。composeCardFlourish()がTitle側のring box-shadow値とPASSの金レイヤーを
   * 1つのshadow-[...]へ安全に合成する（2つのring-*ユーティリティを並べる旧実装は
   * CSS変数の競合で見た目が不安定になるため採用しない）。
   * PASS限定Title装備時（既にborder-amber-400/60で金基調）はそのまま維持する
   * （PASS限定Title自体が既に金テーマのため、追加の併存ロジックは不要）。
   */
  const titleRingBoxShadow = equippedRegularTitle
    ? equippedIsSecret
      ? getSecretTheme().profileRingBoxShadow
      : getTitleRarityTheme(equippedRegularTitle.rarity).profileRingBoxShadow
    : ''
  const titleRingPulseClass = equippedRegularTitle
    ? equippedIsSecret
      ? getSecretTheme().profileRingPulseClass
      : getTitleRarityTheme(equippedRegularTitle.rarity).profileRingPulseClass
    : ''
  const cardFlourishClass = equippedPassTitle
    ? titleFlourishClass
    : [composeCardFlourish(titleRingBoxShadow, hasPass), titleRingPulseClass].filter((c) => c.length > 0).join(' ')

  useEffect(() => {
    trackProfileView()
  }, [])

  function handleEquipPassTitle(titleId: string) {
    const result = equipTitle(titleId, isPassTitleOwned)
    if (result.ok) setProfile(result.profile)
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <NavBar onBack={onBack} onHome={onHome} />

      <div className="flex flex-1 flex-col items-center gap-6 px-6 py-4">
        {/* プレイヤーカード */}
        <div
          className={`relative flex w-full max-w-xs flex-col items-center gap-3 rounded-3xl border border-fuchsia-400/20 bg-gradient-to-b from-white/[0.06] to-white/[0.02] px-6 py-6 text-center shadow-[0_0_30px_rgba(217,70,239,0.08)] ${cardFlourishClass}`}
        >
          {hasPass && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#140a22] p-0.5">
              <DopaPassBadge compact />
            </div>
          )}

          <div
            className={`flex h-20 w-20 items-center justify-center rounded-full bg-fuchsia-500/10 text-4xl ${
              titleFlourishClass || 'border-2 border-fuchsia-400/50 shadow-[0_0_20px_rgba(217,70,239,0.3)]'
            }`}
          >
            {resolveAvatarEmoji(profile.avatar)}
          </div>

          <p className="text-xl font-black text-white">{profile.nickname}</p>

          {equippedPassTitle ? (
            <PassTitleBadge title={equippedPassTitle} onClick={() => setDetailTitleId(profile.equippedTitleId)} />
          ) : equippedRegularTitle ? (
            <TitleBadge title={equippedRegularTitle} onClick={() => setDetailTitleId(profile.equippedTitleId)} />
          ) : (
            <p className="text-xs font-bold tracking-widest text-white/40">称号未装備</p>
          )}

          {/*
            次フェーズ（item 88）: サブ1・サブ2を、カードの外側ではなくこのプレイヤーカード
            内部（メイン称号バッジのすぐ下）へ移動した——メイン/サブ1/サブ2の3つ全てを
            同じカード内に収め、メインが主役・サブ2つは明確に小さく補助的という見た目に
            する（ユーザー指示）。PASSの金枠・上端バッジ・LEGENDARY/MYTHICの装飾
            （titleFlourishClass、カード全体への適用）とは重ならない配置・サイズ感。
            PASS非所有者はサブ枠が常に使えないため、この行自体を出さない。
            次フェーズ（item 89）: タップしても装備管理UIは一切開かない——見るだけ
            （説明・獲得条件の詳細モーダル）。空き枠はタップしても何も起きない。
          */}
          {hasPass && (
            <div className="flex w-full items-center justify-center gap-2">
              {profile.subTitleIds.map((id, index) => (
                <SubTitleBadge key={index} titleId={id} slotLabel={index === 0 ? 'サブ1' : 'サブ2'} onClick={() => setDetailTitleId(id)} />
              ))}
            </div>
          )}

          {ownedPassTitleIds.length > 0 && profile.equippedTitleId !== ownedPassTitleIds[0] && (
            <button
              onClick={() => {
                sfx.titleEquip()
                handleEquipPassTitle(ownedPassTitleIds[0])
              }}
              className="text-[10px] font-bold text-amber-300/80 underline"
            >
              PASS限定Titleを装備する
            </button>
          )}

          <button
            onClick={() => {
              sfx.uiTap()
              onEdit()
            }}
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
          {hasPass ? (
            <button
              onClick={() => {
                sfx.uiTap()
                onOpenPassAnalytics()
              }}
              className="w-full rounded-2xl border border-amber-400/50 bg-amber-500/10 py-3 text-sm font-black text-amber-300 active:scale-95"
            >
              DOPA PASS 詳細分析
            </button>
          ) : (
            <button
              onClick={() => {
                sfx.uiTap()
                onOpenPassPaywall()
              }}
              className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 py-3.5 text-sm font-black text-black shadow-[0_6px_0_0_rgba(180,130,0,0.6)] active:translate-y-1 active:shadow-[0_2px_0_0_rgba(180,130,0,0.6)]"
            >
              DOPA PASSについて見る
            </button>
          )}
          <button
            onClick={() => {
              sfx.uiTap()
              onAchievements()
            }}
            className="w-full rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-3.5 text-base font-black tracking-widest text-white shadow-[0_6px_0_0_rgba(126,34,206,0.8)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(126,34,206,0.8)]"
          >
            ACHIEVEMENT
          </button>
          <button
            onClick={() => {
              sfx.uiTap()
              onRanking()
            }}
            className="w-full rounded-2xl border border-white/15 bg-white/5 py-3 text-base font-black tracking-widest text-white/80 active:scale-95"
          >
            RANKING
          </button>
          <button
            onClick={() => {
              sfx.uiTap()
              onSentChallenges()
            }}
            className="w-full rounded-2xl border border-white/15 bg-white/5 py-3 text-sm font-bold text-white/70 active:scale-95"
          >
            作成したChallenge
          </button>
          <button
            onClick={() => {
              sfx.uiTap()
              onParticipatedChallenges()
            }}
            className="w-full rounded-2xl border border-white/15 bg-white/5 py-3 text-sm font-bold text-white/70 active:scale-95"
          >
            参加したChallenge
          </button>
        </div>
      </div>

      {detailPassTitle && <PassTitleDetailModal title={detailPassTitle} onClose={() => setDetailTitleId(null)} />}
      {detailRegularTitle && (
        <TitleDetailModal achievementId={detailRegularTitle.unlockedByAchievementId} unlocked onClose={() => setDetailTitleId(null)} />
      )}
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
