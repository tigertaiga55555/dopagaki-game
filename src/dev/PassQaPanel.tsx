import { useState } from 'react'
import { qaGrantDopaPass, qaLocalEntitlementRepository, qaRevokeDopaPass } from '../payment/entitlementRepository'

interface Props {
  /** PASS状態を変更した直後に呼ぶ。呼び出し元（TitleScreen.tsx）がrevisionを更新して、PASS依存のUIを再評価させる。 */
  onChange: () => void
}

/**
 * 次フェーズ（DOPA PASS基盤ラウンド）QA補助: DOPA PASSをOFF/ON/発売キャンペーン購入者相当へ
 * 即時切り替えられるパネル。dev/HeartQaPanel.tsxと同じ方針（Preview専用、Productionには
 * 一切表示されない——呼び出し元がisPassQaPanelRequested()で描画自体をガードする）。
 */
export function PassQaPanel({ onChange }: Props) {
  const [open, setOpen] = useState(false)
  const owned = qaLocalEntitlementRepository.getPassState().owned

  return (
    <div className="fixed bottom-3 left-3 z-[80] flex flex-col items-start gap-2">
      {open && (
        <div className="anim-pop w-56 rounded-xl border border-amber-400/40 bg-black/90 p-3 shadow-xl">
          <p className="mb-2 text-[10px] font-black tracking-widest text-amber-300">
            QA: DOPA PASS（現在: {owned ? 'ON' : 'OFF'}）
          </p>
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => {
                qaRevokeDopaPass()
                onChange()
              }}
              className="rounded-lg bg-white/10 py-1.5 text-[11px] font-black text-white active:scale-95"
            >
              OFF（無料ユーザー）
            </button>
            <button
              onClick={() => {
                qaGrantDopaPass(Date.now(), false)
                onChange()
              }}
              className="rounded-lg bg-white/10 py-1.5 text-[11px] font-black text-white active:scale-95"
            >
              ON（通常購入）
            </button>
            <button
              onClick={() => {
                qaGrantDopaPass(Date.now(), true)
                onChange()
              }}
              className="rounded-lg bg-amber-500/80 py-1.5 text-[11px] font-black text-black active:scale-95"
            >
              ON（キャンペーン購入者相当・初代ドパガキ付与）
            </button>
          </div>
          <p className="mt-2 text-[9px] font-bold leading-tight text-white/40">Preview専用。本番には一切表示されません。</p>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full bg-amber-600/90 px-3 py-1.5 text-[11px] font-black text-white shadow-lg active:scale-90"
      >
        {open ? 'QA ×' : '🔧 PASS'}
      </button>
    </div>
  )
}
