import { useState } from 'react'
import {
  qaLockAllAchievements,
  qaLockSecretAchievements,
  qaUnlockAchievementsByRarity,
  qaUnlockAllAchievements,
  qaUnlockSecretAchievements,
} from './achievementQaRepository'
import { qaGrantDopaPass, qaLocalEntitlementRepository, qaRevokeDopaPass } from '../payment/entitlementRepository'
import type { TitleRarity } from '../types'

interface Props {
  /** 状態を変更した直後に呼ぶ。呼び出し元（AchievementScreen.tsx）がrevisionを更新して、画面を再評価させる。 */
  onChange: () => void
}

const RARITY_BUTTONS: { rarity: TitleRarity; label: string }[] = [
  { rarity: 'common', label: 'COMMON' },
  { rarity: 'rare', label: 'RARE' },
  { rarity: 'epic', label: 'EPIC' },
  { rarity: 'legendary', label: 'LEGENDARY' },
  { rarity: 'mythic', label: 'MYTHIC' },
]

/**
 * 次フェーズ（ゲーム機能クローズラウンド、item 116: リリース前最終デザインラウンド）:
 * Achievement/Title確認用の統合QAパネル。既存のdev/HeartQaPanel.tsx・dev/PassQaPanel.tsxと
 * 同じ方針（Preview専用、Productionには一切表示されない——呼び出し元
 * （AchievementScreen.tsx）がisAchievementQaPanelRequested()で描画自体をガードする）。
 *
 * 実際の解除/ロック操作自体はdev/achievementQaRepository.tsに集約し、そちらの各関数も
 * __DOPAGAKI_PREVIEW_ENABLED__がfalseなら即returnする二重の安全策にしている
 * （UIを隠すだけでなく、機能自体がProductionビルドで構造的に無効）。
 */
export function AchievementQaPanel({ onChange }: Props) {
  const [open, setOpen] = useState(false)
  const hasPass = qaLocalEntitlementRepository.getPassState().owned

  function run(fn: () => void) {
    fn()
    onChange()
  }

  return (
    <div className="fixed bottom-3 right-3 z-[80] flex flex-col items-end gap-2">
      {open && (
        <div className="anim-pop w-60 rounded-xl border border-fuchsia-400/40 bg-black/90 p-3 shadow-xl">
          <p className="mb-2 text-[10px] font-black tracking-widest text-fuchsia-300">QA: Achievement / Title</p>
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => run(qaUnlockAllAchievements)}
              className="rounded-lg bg-white/10 py-1.5 text-[11px] font-black text-white active:scale-95"
            >
              全Achievement/Title解除
            </button>
            <button
              onClick={() => run(qaLockAllAchievements)}
              className="rounded-lg bg-white/10 py-1.5 text-[11px] font-black text-white active:scale-95"
            >
              全ロック状態へ戻す
            </button>
          </div>

          <div className="mt-2.5 border-t border-white/10 pt-2.5">
            <p className="mb-1.5 text-[10px] font-black tracking-widest text-indigo-300">QA: SECRET</p>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => run(qaUnlockSecretAchievements)}
                className="rounded-lg bg-white/10 py-1.5 text-[11px] font-black text-white active:scale-95"
              >
                SECRETだけ解除
              </button>
              <button
                onClick={() => run(qaLockSecretAchievements)}
                className="rounded-lg bg-white/10 py-1.5 text-[11px] font-black text-white active:scale-95"
              >
                SECRETだけロック
              </button>
            </div>
          </div>

          <div className="mt-2.5 border-t border-white/10 pt-2.5">
            <p className="mb-1.5 text-[10px] font-black tracking-widest text-amber-300">QA: rarity別に解除</p>
            <div className="grid grid-cols-2 gap-1.5">
              {RARITY_BUTTONS.map(({ rarity, label }) => (
                <button
                  key={rarity}
                  onClick={() => run(() => qaUnlockAchievementsByRarity(rarity))}
                  className="rounded-lg bg-white/10 py-1.5 text-[10px] font-black text-white active:scale-95"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2.5 border-t border-white/10 pt-2.5">
            <p className="mb-1.5 text-[10px] font-black tracking-widest text-amber-300">QA: DOPA PASS（現在: {hasPass ? 'ON' : 'OFF'}）</p>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => run(qaRevokeDopaPass)}
                className="rounded-lg bg-white/10 py-1.5 text-[11px] font-black text-white active:scale-95"
              >
                OFF（無料ユーザー・メイン1枠）
              </button>
              <button
                onClick={() => run(() => qaGrantDopaPass(Date.now(), false))}
                className="rounded-lg bg-amber-500/80 py-1.5 text-[11px] font-black text-black active:scale-95"
              >
                ON（PASS・メイン+サブ1+サブ2）
              </button>
            </div>
          </div>

          <p className="mt-2 text-[9px] font-bold leading-tight text-white/40">Preview専用。本番には一切表示されません。</p>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full bg-fuchsia-600/90 px-3 py-1.5 text-[11px] font-black text-white shadow-lg active:scale-90"
      >
        {open ? 'QA ×' : '🔧 Title'}
      </button>
    </div>
  )
}
