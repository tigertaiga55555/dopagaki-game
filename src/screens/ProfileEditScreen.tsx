import { useState } from 'react'
import { BackButton } from '../components/BackButton'
import { ICON_CATEGORIES, NICKNAME_MAX_LENGTH, PRESET_ICON_EMOJI, resolveAvatarEmoji } from '../config/profileConfig'
import { trackProfileEdit } from '../utils/analytics'
import { getProfile, updateIcon, updateNickname } from '../utils/profileStorage'
import type { PresetIconId } from '../types'

interface Props {
  onDone: () => void
}

/**
 * Ver.6 Phase 5.1（icon拡充）: ニックネーム編集＋プリセットアイコン選択（24種、5カテゴリ）。
 * ユーザー画像アップロードは今回実装しない（既存emojiのプリセットから選ぶだけ。
 * 将来の自分の写真設定は、サーバーProfile基盤＋画像ストレージ実装時にavatar.kind=
 * 'remoteCustom'として追加する想定——types.ts AvatarRef参照）。
 */
export function ProfileEditScreen({ onDone }: Props) {
  const initial = getProfile()
  const [nickname, setNickname] = useState(initial.nickname)
  const [iconId, setIconId] = useState<PresetIconId>(initial.avatar.kind === 'preset' ? initial.avatar.iconId : 'bolt')

  function handleSave() {
    updateNickname(nickname)
    updateIcon(iconId)
    trackProfileEdit()
    onDone()
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <BackButton onBack={onDone} label="キャンセル" />

      <div className="flex flex-1 flex-col items-center gap-6 px-6 py-4 pb-10">
        <h1 className="text-lg font-black tracking-widest text-white">プロフィール編集</h1>

        <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-fuchsia-400/50 bg-fuchsia-500/10 text-4xl shadow-[0_0_20px_rgba(217,70,239,0.3)]">
          {resolveAvatarEmoji({ kind: 'preset', iconId })}
        </div>

        <div className="w-full max-w-xs">
          <label className="mb-1 flex items-center justify-between text-xs font-bold text-white/50">
            <span>ニックネーム</span>
            <span className="tabular-nums">
              {Array.from(nickname).length} / {NICKNAME_MAX_LENGTH}
            </span>
          </label>
          <input
            value={nickname}
            onChange={(e) => {
              const next = Array.from(e.target.value).slice(0, NICKNAME_MAX_LENGTH).join('')
              setNickname(next)
            }}
            maxLength={NICKNAME_MAX_LENGTH * 2}
            placeholder="ニックネーム"
            className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-base font-bold text-white outline-none focus:border-fuchsia-400/60"
          />
        </div>

        <div className="w-full max-w-xs space-y-4">
          <p className="text-xs font-bold text-white/50">アイコンを選ぶ</p>
          {ICON_CATEGORIES.map((category) => (
            <div key={category.id}>
              <p className="mb-1.5 text-[10px] font-black tracking-widest text-white/35">{category.label}</p>
              <div className="grid grid-cols-5 gap-2.5">
                {category.icons.map((id) => {
                  const selected = id === iconId
                  return (
                    <button
                      key={id}
                      onClick={() => setIconId(id)}
                      aria-pressed={selected}
                      className={`flex aspect-square items-center justify-center rounded-2xl text-xl transition-transform active:scale-90 ${
                        selected
                          ? 'border-2 border-fuchsia-400 bg-fuchsia-500/20 shadow-[0_0_14px_rgba(217,70,239,0.4)]'
                          : 'border border-white/10 bg-white/5'
                      }`}
                    >
                      {PRESET_ICON_EMOJI[id]}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          className="mt-2 w-full max-w-xs rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-4 text-base font-black tracking-widest text-white shadow-[0_6px_0_0_rgba(126,34,206,0.8)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(126,34,206,0.8)]"
        >
          保存する
        </button>
      </div>
    </div>
  )
}
