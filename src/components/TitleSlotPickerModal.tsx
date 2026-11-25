import { PASS_TITLE_DEFS_BY_ID } from '../config/passTitles'
import { TITLE_DEFS_BY_ID } from '../config/titles'
import { getTitleRarityTheme } from '../config/titleRarityTheme'
import { sfx } from '../utils/sound'
import type { PlayerProfile, TitleId } from '../types'
import type { TitleSlot } from '../utils/profileStorage'

interface Props {
  profile: PlayerProfile
  hasPass: boolean
  /**
   * 装備しようとしている新しいTitle（AchievementScreen.tsxの「装備する」から開いた場合）。
   * 省略すると「管理のみモード」（ProfileScreen.tsxのサブ枠バッジタップから開いた場合）
   * になり、既存の枠の「外す」操作だけができる——新しいTitleをどこかへ割り当てる
   * ボタンは出さない（空き枠に何を入れるかはAchievement画面側の役割のまま）。
   */
  pendingTitleId?: TitleId
  /** pendingTitleIdが無い（管理のみモード）場合は呼ばれない——省略可。 */
  onEquip?: (slot: TitleSlot) => void
  onUnequip: (slot: TitleSlot) => void
  onClose: () => void
}

const SLOT_LABEL: Record<TitleSlot, string> = { main: 'メイン', sub1: 'サブ1', sub2: 'サブ2' }
const SLOT_EQUIP_LABEL: Record<TitleSlot, string> = { main: 'メインに装備', sub1: 'サブ1に装備', sub2: 'サブ2に装備' }

function resolveTitleName(titleId: TitleId | null): string | null {
  if (!titleId) return null
  return TITLE_DEFS_BY_ID[titleId]?.name ?? PASS_TITLE_DEFS_BY_ID[titleId]?.name ?? null
}

/**
 * 次フェーズ（ゲーム機能クローズラウンド、item 72-74）: main/sub1/sub2の3枠を1画面で
 * 見せる「軽量なProfileプレビュー」兼、実際の装備先選択／取り外しUI。
 *
 * ユーザー指示: 「タップした瞬間に即装備」ではなく、まずこのプレビューを見せてから
 * 枠を選ばせる。無料ユーザーにはsub1/sub2の行自体を一切見せない（グレーアウトして
 * 選べない状態で見せるのではなく、行そのものを出さない——「無料ユーザーは常に
 * 『メインに装備』だけが見える」というユーザー指示の文言どおり）。
 */
export function TitleSlotPickerModal({ profile, hasPass, pendingTitleId, onEquip, onUnequip, onClose }: Props) {
  const pendingName = pendingTitleId ? resolveTitleName(pendingTitleId) : null
  const slots: TitleSlot[] = hasPass ? ['main', 'sub1', 'sub2'] : ['main']

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 px-6" onClick={onClose}>
      <div
        className="anim-pop w-full max-w-xs rounded-3xl border border-white/10 bg-[#1a0e2e] p-5 text-center shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="mb-1 text-xs font-black tracking-widest text-white/40">TITLE 装備枠</p>
        {pendingName && <p className="mb-4 text-sm font-black text-amber-200">「{pendingName}」をどの枠に装備しますか？</p>}
        {!pendingName && <p className="mb-4 text-xs font-bold text-white/50">各枠の装備を確認・取り外しできます</p>}

        <div className="space-y-2">
          {slots.map((slot) => {
            const currentId = slot === 'main' ? profile.equippedTitleId : profile.subTitleIds[slot === 'sub1' ? 0 : 1]
            const currentName = resolveTitleName(currentId)
            const currentDef = currentId ? TITLE_DEFS_BY_ID[currentId] : null
            const theme = currentDef ? getTitleRarityTheme(currentDef.rarity) : null
            const holdsPending = pendingTitleId !== undefined && currentId === pendingTitleId

            return (
              <div key={slot} className="flex items-center justify-between gap-2 rounded-2xl bg-white/5 px-3 py-2.5">
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[9px] font-black tracking-widest text-white/35">{SLOT_LABEL[slot]}</p>
                  {currentName ? (
                    <p className={`truncate text-xs font-black ${theme ? theme.badgeTextClass : 'text-amber-200'}`}>{currentName}</p>
                  ) : (
                    <p className="text-xs font-bold text-white/30">空き</p>
                  )}
                </div>
                {holdsPending ? (
                  <button
                    onClick={() => {
                      sfx.uiTap()
                      onUnequip(slot)
                    }}
                    className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/70 active:scale-95"
                  >
                    外す
                  </button>
                ) : pendingTitleId !== undefined ? (
                  <button
                    onClick={() => {
                      // 次フェーズ（item 149-153、UI効果音拡充ラウンド）: ここが「称号を実際に
                      // 装備する」が確定する瞬間——専用のtitleEquip()を鳴らす（uiTapではない）。
                      sfx.titleEquip()
                      onEquip?.(slot)
                    }}
                    className="shrink-0 rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-600 px-3 py-1.5 text-[11px] font-black text-white active:scale-95"
                  >
                    {SLOT_EQUIP_LABEL[slot]}
                  </button>
                ) : currentId ? (
                  <button
                    onClick={() => {
                      sfx.uiTap()
                      onUnequip(slot)
                    }}
                    className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/70 active:scale-95"
                  >
                    外す
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>

        {!hasPass && <p className="mt-3 text-[10px] font-bold text-white/30">サブ枠（あと2つ）はDOPA PASS限定です</p>}

        <button
          onClick={() => {
            sfx.uiTap()
            onClose()
          }}
          className="mt-4 w-full rounded-2xl bg-white/10 py-3 text-sm font-black text-white active:scale-95"
        >
          閉じる
        </button>
      </div>
    </div>
  )
}
