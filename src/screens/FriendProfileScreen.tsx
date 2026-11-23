import { useEffect, useState } from 'react'
import { NavBar } from '../components/NavBar'
import { DopaPassBadge } from '../components/DopaPassBadge'
import { resolveAvatarEmoji } from '../config/profileConfig'
import { TITLE_DEFS_BY_ID } from '../config/titles'
import { PASS_TITLE_DEFS_BY_ID } from '../config/passTitles'
import { getFriendPublicProfile, getFriendRelationshipStatus, sendFriendRequestByPlayerId } from '../friends/friendsClient'
import type { FriendRelationshipStatus, PublicProfileSnapshot } from '../friends/types'

interface Props {
  onBack: () => void
  onHome: () => void
  playerId: string
  /** 次フェーズ（FRIENDS/TABLE/ナビ追加調整ラウンド、item 48）: 自分自身のplayerId。自分のカードには申請ボタンを一切出さない。 */
  viewerPlayerId: string
}

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; profile: PublicProfileSnapshot }

/**
 * 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 27 → FRIENDS/TABLE/ナビ追加調整ラウンド、item 48で拡張）:
 * フレンド（またはロビーで一緒になった誰か）の公開プロフィール画面。ProfileScreen.tsx
 * （自分自身）が既に公開している情報の部分集合だけを表示する——ニックネーム・アバター・
 * メインTitle・PASSバッジ・最高DOPA%・ENDLESS BEST・世界対戦勝利数・実績解除数。
 * 非公開情報（プレイ履歴の詳細・フレンド一覧そのもの等）は一切表示しない。
 *
 * item 48: ロビーのメンバーカードからこの画面を開いた場合、まだ友達でない相手には
 * 「フレンド申請」ボタンを出し、既に友達なら「フレンド」ラベルだけを表示、自分自身の
 * カードならどちらも出さない——既存のFriendProfileScreenを複製せずそのまま再利用する
 * （コーディネーターの明示指示）。
 *
 * 誠実な既知のギャップ: ここに表示される数値は、その相手が最後にアプリを開いた/
 * プロフィールを保存した時点のスナップショット（utils/publicProfileSync.ts）であり、
 * ライブな最新値ではない——Profile画面同様の体裁で見せているが、情報源の性質が違う
 * ことは最終報告書に明記する。
 */
export function FriendProfileScreen({ onBack, onHome, playerId, viewerPlayerId }: Props) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const isSelf = playerId === viewerPlayerId
  const [relationship, setRelationship] = useState<FriendRelationshipStatus | null>(null)
  const [requestSent, setRequestSent] = useState(false)

  useEffect(() => {
    let cancelled = false
    getFriendPublicProfile(playerId).then((profile) => {
      if (cancelled) return
      setState(profile ? { status: 'ready', profile } : { status: 'error' })
    })
    if (!isSelf) {
      getFriendRelationshipStatus(viewerPlayerId, playerId).then((status) => {
        if (!cancelled) setRelationship(status)
      })
    }
    return () => {
      cancelled = true
    }
  }, [playerId, viewerPlayerId, isSelf])

  async function handleSendRequest() {
    setRequestSent(true)
    await sendFriendRequestByPlayerId(viewerPlayerId, playerId)
  }

  const equippedPassTitle = state.status === 'ready' && state.profile.equippedTitleId ? PASS_TITLE_DEFS_BY_ID[state.profile.equippedTitleId] : null
  const equippedRegularTitle =
    state.status === 'ready' && !equippedPassTitle && state.profile.equippedTitleId ? TITLE_DEFS_BY_ID[state.profile.equippedTitleId] : null

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <NavBar onBack={onBack} onHome={onHome} />

      <div className="flex flex-1 flex-col items-center gap-4 px-6 py-4">
        {state.status === 'loading' && <p className="mt-10 text-sm font-bold text-white/50">読み込み中…</p>}
        {state.status === 'error' && <p className="mt-10 text-sm font-bold text-white/50">プロフィールを読み込めませんでした</p>}

        {state.status === 'ready' && (
          <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-3xl border border-fuchsia-400/20 bg-gradient-to-b from-white/[0.06] to-white/[0.02] px-6 py-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-fuchsia-400/50 bg-fuchsia-500/10 text-4xl">
              {resolveAvatarEmoji(state.profile.avatar)}
            </div>
            {state.profile.hasDopaPass && <DopaPassBadge />}
            <p className="text-xl font-black text-white">{state.profile.nickname}</p>
            {equippedPassTitle ? (
              <p className="rounded-full bg-amber-400/15 px-3 py-1 text-xs font-black text-amber-300">{equippedPassTitle.name}</p>
            ) : equippedRegularTitle ? (
              <p className="rounded-full bg-fuchsia-500/15 px-3 py-1 text-xs font-black text-fuchsia-200">{equippedRegularTitle.name}</p>
            ) : (
              <p className="text-xs font-bold tracking-widest text-white/40">称号未装備</p>
            )}

            {!isSelf && relationship !== null && (
              <div>
                {relationship === 'friends' ? (
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-300">✓ フレンド</span>
                ) : relationship === 'pending_outgoing' || requestSent ? (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/50">申請済み</span>
                ) : relationship === 'pending_incoming' ? (
                  <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-300">フレンド申請が届いています</span>
                ) : (
                  <button
                    onClick={handleSendRequest}
                    className="rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-600 px-4 py-1.5 text-xs font-black text-white active:scale-95"
                  >
                    ＋ フレンド申請
                  </button>
                )}
              </div>
            )}

            <div className="mt-2 w-full space-y-2 rounded-2xl bg-white/5 px-4 py-4 text-left">
              <StatRow label="最高DOPA%" value={`${state.profile.bestDopaPercent}%`} />
              <StatRow label="Endless 初級 BEST" value={`${state.profile.endlessBeginnerBest} STREAK`} />
              <StatRow label="Endless 中級 BEST" value={`${state.profile.endlessIntermediateBest} STREAK`} />
              <StatRow label="Endless 上級 BEST" value={`${state.profile.endlessAdvancedBest} STREAK`} />
              <StatRow label="世界対戦 累計勝利数" value={`${state.profile.worldBattleWins}勝`} />
              <StatRow label="実績解除数" value={`${state.profile.achievementCount}`} />
            </div>
            <p className="text-[9px] text-white/25">最後に更新: {new Date(state.profile.updatedAt).toLocaleDateString('ja-JP')}</p>
          </div>
        )}
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
