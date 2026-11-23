import { useState } from 'react'
import { qaGrantDopaPass, qaLocalEntitlementRepository, qaRevokeDopaPass } from '../payment/entitlementRepository'
import { getEffectiveReleaseAtMs, isLaunchCampaignActive, qaSetReleaseAtOverrideMs } from '../config/dopaPassConfig'

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
  // 次フェーズ（item 51）: 正式リリース日をDate.now()からの相対値ではなく固定の実在未来日へ
  // 変更したため、通常は発売日前のPreviewでキャンペーンが非アクティブのまま静止する
  // （正しい挙動）。QA担当者がキャンペーン中/非キャンペーン中のどちらの見た目も即座に
  // 確認できるよう、既存のqaSetReleaseAtOverrideMs（以前は未使用のまま埋まっていた）を
  // ここから操作できるようにした。
  const isOverridden = (() => {
    try {
      return localStorage.getItem('dopagaki:qaPassReleaseAtOverrideV1') !== null
    } catch {
      return false
    }
  })()
  const campaignActiveNow = isLaunchCampaignActive(Date.now(), getEffectiveReleaseAtMs())

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
          <div className="mt-2.5 border-t border-white/10 pt-2.5">
            <p className="mb-1.5 text-[10px] font-black tracking-widest text-amber-300">
              QA: 発売キャンペーン表示（現在: {campaignActiveNow ? 'アクティブ' : '未開始'}
              {isOverridden ? '・上書き中' : ''}）
            </p>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => {
                  qaSetReleaseAtOverrideMs(Date.now() - 3 * 24 * 60 * 60 * 1000)
                  onChange()
                }}
                className="rounded-lg bg-white/10 py-1.5 text-[11px] font-black text-white active:scale-95"
              >
                キャンペーン中を試す（発売日を3日前へ）
              </button>
              <button
                onClick={() => {
                  qaSetReleaseAtOverrideMs(null)
                  onChange()
                }}
                disabled={!isOverridden}
                className="rounded-lg bg-white/10 py-1.5 text-[11px] font-black text-white active:scale-95 disabled:opacity-40"
              >
                上書きを解除（実際の発売日に戻す）
              </button>
            </div>
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
