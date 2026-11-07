import { useState } from 'react'
import { BackButton } from '../components/BackButton'
import { NICKNAME_MAX_LENGTH, PRESET_ICONS, PRESET_ICON_EMOJI } from '../config/profileConfig'
import { trackProfileEdit } from '../utils/analytics'
import { getProfile, updateIcon, updateNickname } from '../utils/profileStorage'
import type { PresetIconId } from '../types'

interface Props {
  onDone: () => void
}

/**
 * Ver.6 Phase 5（Profile/Achievement/Ranking基盤）: ニックネーム編集＋プリセットアイコン選択。
 * ユーザー画像アップロードは今回実装しない（既存emojiのプリセットから選ぶだけ）。
 */
export function ProfileEditScreen({ onDone }: Props) {
  const initial = getProfile()
  const [nickname, setNickname] = useState(initial.nickname)
  const [iconId, setIconId] = useState<PresetIconId>(initial.iconId)

  function handleSave() {
    updateNickname(nickname)
    updateIcon(iconId)
    trackProfileEdit()
    onDone()
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <BackButton onBack={onDone} label="キャンセル" />

      <div className="flex flex-1 flex-col items-center gap-6 px-6 py-4">
        <h1 className="text-lg font-black tracking-widest text-white">プロフィール編集</h1>

        <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-fuchsia-400/50 bg-fuchsia-500/10 text-4xl shadow-[0_0_20px_rgba(217,70,239,0.3)]">
          {PRESET_ICON_EMOJI[iconId]}
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

        <div className="w-full max-w-xs">
          <p className="mb-2 text-xs font-bold text-white/50">アイコンを選ぶ</p>
          <div className="grid grid-cols-4 gap-3">
            {PRESET_ICONS.map((id) => {
              const selected = id === iconId
              return (
                <button
                  key={id}
                  onClick={() => setIconId(id)}
                  aria-pressed={selected}
                  className={`flex aspect-square items-center justify-center rounded-2xl text-2xl transition-transform active:scale-90 ${
                    selected ? 'border-2 border-fuchsia-400 bg-fuchsia-500/20 shadow-[0_0_14px_rgba(217,70,239,0.4)]' : 'border border-white/10 bg-white/5'
                  }`}
                >
                  {PRESET_ICON_EMOJI[id]}
                </button>
              )
            })}
          </div>
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
