import { useEffect, useState } from 'react'
import { NavBar } from '../components/NavBar'
import { getCurrentPassPrice, getEffectiveReleaseAtMs, daysRemainingInLaunchCampaign, isLaunchCampaignActive } from '../config/dopaPassConfig'
import { qaPaymentAdapter } from '../payment/qaPaymentAdapter'
import { trackPassPaywallView, trackPassPurchaseCancel, trackPassPurchaseError, trackPassPurchaseStart, type PassPaywallSource } from '../utils/analytics'

interface Props {
  source: PassPaywallSource
  onBack: () => void
  onHome: () => void
  onPurchased: () => void
}

interface ValuePoint {
  icon: string
  title: string
  description: string
  comingSoon?: boolean
}

/**
 * 次フェーズ（DOPA PASS基盤ラウンド）: DOPA PASS購入画面。
 *
 * 価値訴求の優先順位（ユーザー指示、絶対にHeart無制限や広告非表示をトップに出さない）:
 * 1.PRIVATE ROOM作成権 2.友達は無料参加 3.Heart無制限 4.広告非表示
 * 5.履歴の完全保存 6.詳細分析 7.クラウド保存/将来のWeb-iPhone同期（COMING SOON）
 * 8.Profile強化 9.複数Title表示 10.PASS限定バッジ/装飾。
 * 今回実装していないもの（クラウド保存/将来同期）は「COMING SOON」と明示し、
 * 「今すぐ使える」かのように見せない。
 *
 * 価格・キャンペーン判定は必ずconfig/dopaPassConfig.ts経由（UIへハードコードしない）。
 * 残り日数表示は秒単位カウントダウンにしない。クライアントの時計は最終的な購入価格の
 * 権威にはしない——ここで表示する価格はあくまで購入前の目安であり、将来の実決済
 * プロバイダが確定する価格が最終的な権威になる。
 */
const VALUE_POINTS: ValuePoint[] = [
  {
    icon: '🤝',
    title: '最大8人で「友達と対戦」を作れる',
    description: '友達だけで集まれる専用ルームを、何度でも作成できます。単発のフレンド対戦URLはもう存在しません——友達との対戦はこのモードだけの特別な体験です。',
  },
  { icon: '👥', title: '友達の参加はいつでも無料', description: 'あなたが作ったルームに、友達は誰でも無料で何度でも参加・対戦できます。' },
  { icon: '❤️', title: 'Heart無制限', description: 'DOPA RUSH/ENDLESSの挑戦回数を気にせず、いつでもプレイできます。' },
  { icon: '🚫', title: '広告非表示', description: 'バナー・インタースティシャル広告が一切表示されなくなります。' },
  { icon: '📜', title: '履歴を完全保存', description: 'Challenge・World Battleの全履歴を、件数制限なく確認できます。' },
  { icon: '📊', title: '詳細分析', description: '世界対戦の平均パフォーマンス等、PASS限定の詳細分析画面が使えます。' },
  { icon: '☁️', title: 'クラウド保存 / Web-iPhone同期', description: '将来、複数端末でのデータ共有に対応予定です。', comingSoon: true },
  { icon: '🎨', title: 'Profile強化', description: 'プロフィール画面がPASS専用の見た目で強化されます。' },
  { icon: '🏷️', title: '複数Titleを表示', description: '装備中Titleに加えて、お気に入りTitleを最大3個まで表示できます。' },
  { icon: '👑', title: 'PASS限定バッジ・装飾', description: 'DOPA PASS所有者だけの特別な見た目が手に入ります。' },
]

export function PassPaywallScreen({ source, onBack, onHome, onPurchased }: Props) {
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const now = Date.now()
  const releaseAt = getEffectiveReleaseAtMs()
  const price = getCurrentPassPrice(now, releaseAt)
  const campaignActive = isLaunchCampaignActive(now, releaseAt)
  const daysLeft = daysRemainingInLaunchCampaign(now, releaseAt)

  useEffect(() => {
    trackPassPaywallView(source)
  }, [source])

  async function handlePurchase() {
    setBusy(true)
    setErrorMessage(null)
    trackPassPurchaseStart()
    const result = await qaPaymentAdapter.startPurchase('dopa_pass')
    setBusy(false)
    if (result.ok) {
      onPurchased()
      return
    }
    if (result.reason === 'cancelled') trackPassPurchaseCancel()
    else trackPassPurchaseError()
    setErrorMessage('購入を完了できませんでした（QA）')
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <NavBar onBack={onBack} onHome={onHome} />

      <div className="flex flex-1 flex-col items-center gap-4 px-6 py-4">
        <h1 className="text-2xl font-black tracking-wide text-amber-300">DOPA PASS</h1>

        {campaignActive && (
          <p className="rounded-full border border-amber-400/50 bg-amber-500/10 px-3 py-1 text-[11px] font-black text-amber-300">
            発売キャンペーン中・残り{daysLeft}日
          </p>
        )}

        <div className="flex items-end gap-1">
          {campaignActive && <span className="text-sm font-bold text-white/30 line-through">¥1,980</span>}
          <span className="text-4xl font-black text-white">¥{price.toLocaleString()}</span>
          <span className="text-xs font-bold text-white/40">買い切り</span>
        </div>

        {campaignActive && (
          <p className="text-[11px] font-bold text-amber-200/80">今購入すると「初代ドパガキ」Titleが永久に付与されます</p>
        )}

        <div className="w-full max-w-xs space-y-2">
          {VALUE_POINTS.map((point) => (
            <div key={point.title} className="flex items-start gap-2 rounded-xl bg-white/5 px-3 py-2.5">
              <span aria-hidden="true" className="text-lg leading-none">
                {point.icon}
              </span>
              <div className="flex-1 text-left">
                <p className="flex items-center gap-1.5 text-xs font-black text-white">
                  {point.title}
                  {point.comingSoon && (
                    <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-black text-white/50">COMING SOON</span>
                  )}
                </p>
                <p className="text-[11px] leading-snug text-white/50">{point.description}</p>
              </div>
            </div>
          ))}
        </div>

        {errorMessage && <p className="text-xs font-bold text-rose-300">{errorMessage}</p>}

        <button
          onClick={handlePurchase}
          disabled={busy}
          className="w-full max-w-xs rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 py-3.5 text-base font-black text-black shadow-[0_6px_0_0_rgba(180,130,0,0.6)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(180,130,0,0.6)] disabled:opacity-60"
        >
          {busy ? '処理中…' : `¥${price.toLocaleString()} で購入（QA）`}
        </button>
        <p className="text-[9px] leading-tight text-white/25">
          ※ Previewの検証用QA購入です。実際の決済は発生しません（実決済プロバイダは今回のラウンドでは未接続）。
        </p>
      </div>
    </div>
  )
}
