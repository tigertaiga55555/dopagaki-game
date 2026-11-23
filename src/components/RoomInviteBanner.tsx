import { resolveAvatarEmoji } from '../config/profileConfig'
import type { PublicProfileSnapshot } from '../friends/types'

interface Props {
  fromProfile: PublicProfileSnapshot
  onAccept: () => void
  onDismiss: () => void
}

/**
 * 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 31）: 「○○さんからPRIVATE ROOMに
 * 招待されました」のバナー。ユーザー指定の文言・[参加]/[あとで]の2択どおり。
 * どの画面にいても（App.tsxのpresence接続はアプリ起動中ずっと張られているため）
 * 届いた瞬間にこのバナーが前面に出る。
 */
export function RoomInviteBanner({ fromProfile, onAccept, onDismiss }: Props) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[95] flex justify-center px-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
      <div className="pointer-events-auto anim-pop flex w-full max-w-xs items-center gap-2 rounded-2xl border border-fuchsia-400/30 bg-[#1a0e2e] px-4 py-3 shadow-2xl">
        <span className="text-2xl">{resolveAvatarEmoji(fromProfile.avatar)}</span>
        <p className="min-w-0 flex-1 text-xs font-bold leading-snug text-white">
          {fromProfile.nickname}さんから
          <br />
          友達と対戦に招待されました
        </p>
        <div className="flex flex-col gap-1">
          <button onClick={onAccept} className="rounded-full bg-fuchsia-500 px-3 py-1 text-[11px] font-black text-white active:scale-95">
            参加
          </button>
          <button onClick={onDismiss} className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-white/60 active:scale-95">
            あとで
          </button>
        </div>
      </div>
    </div>
  )
}
