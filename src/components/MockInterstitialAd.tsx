import { useEffect, useState } from 'react'
import { sfx } from '../utils/sound'

interface Props {
  onClose: () => void
}

const CLOSE_DELAY_MS = 2000

/**
 * 次フェーズ（DOPA PASS基盤ラウンド）: 強制インタースティシャルのモック表示。実広告
 * ネットワークは今回も接続しない（ADS_ENABLED_V6=false）——「次のアクション時に、直前の
 * 結果の上に即座には出さず、ユーザーが次へ進もうとした瞬間に挟む」という仕様の動作確認
 * だけが目的。閉じるボタンは一定時間後に出す（実際のインタースティシャルの挙動に寄せる）。
 */
export function MockInterstitialAd({ onClose }: Props) {
  const [canClose, setCanClose] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setCanClose(true), CLOSE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="fixed inset-0 z-[95] flex flex-col items-center justify-center bg-black px-6 text-center">
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-white/40">広告（QAモック）</p>
      <p className="mb-8 text-2xl font-black text-white/70">インタースティシャル</p>
      {canClose ? (
        <button
          onClick={() => {
            sfx.uiTap()
            onClose()
          }}
          className="rounded-2xl bg-white/10 px-8 py-3 text-sm font-black text-white active:scale-95"
        >
          閉じる
        </button>
      ) : (
        <p className="text-xs font-bold text-white/30">少々お待ちください…</p>
      )}
    </div>
  )
}
