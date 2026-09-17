import { useEffect, useRef, useState } from 'react'
import { ResultCard } from '../components/ResultCard'
import { FINAL_TRIAL_CONFIG } from '../config/finalTrialConfig'
import { getRetryLabel } from '../config/messagesV4'
import { captureResultCardPng, downloadPngBlob } from '../utils/shareImage'
import { copyShareText, shareResultWithImage } from '../utils/share'
import { sfx } from '../utils/sound'
import type { FinalResultV4 } from '../types'

interface Props {
  result: FinalResultV4
  onRetry: () => void
}

const TOAST_MS = 3200

/**
 * Ver.5.0追加修正: 共有PNG生成専用offscreen capture wrapperのbleed（padding）を、
 * カードのbox-shadowグロー半径に応じてバリアントごとに変える。
 * 以前は全バリアント一律140pxにしていたが、実機で「カードが小さくなりすぎる」
 * 「右側・右下に黒い矩形領域が残る」不具合が報告された。一律140pxは全バリアント中
 * 最大のisMax(110pxブラー)にしか必要ない過剰な余白で、通常・OVERDRIVEカードまで
 * 無駄に大きなoffscreen領域（＝大きなキャプチャ用canvas）を生成させていたことが、
 * 実機側のレンダリング不具合（黒い矩形）を誘発しやすくしていたと考えられるため、
 * 各バリアントの実際のブラー半径に対して必要十分な値だけを個別に割り当てる
 * （通常: 20pxオフセット+40pxブラー→60px、OVERDRIVE: 60pxブラー→70px、
 * isMax: 110pxブラー→120px）。これによりカードの見た目の大きさもグローの
 * にじみ具合に対して自然な比率へ戻る。
 */
function getCaptureBleedPx(percent: number): number {
  if (percent >= FINAL_TRIAL_CONFIG.clearPercent) return 120
  if (percent > 100) return 70
  return 60
}

export function ResultScreen({ result, onRetry }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Ver.5.0追加(TASK C-12): 200%結果画面へ切り替わった瞬間、完全無音にせず
  // bell/sparkle/victory chordのごく控えめな余韻を一度だけ残す。
  useEffect(() => {
    if (result.percent >= FINAL_TRIAL_CONFIG.clearPercent) {
      sfx.resultChime200()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  function showToast(message: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(message)
    toastTimerRef.current = setTimeout(() => setToast(null), TOAST_MS)
  }

  /**
   * Ver.5.0追加: 「画像付きでシェア」。結果カードDOMをそのままPNG化し、
   * Web Share API（ファイル共有対応環境）→テキスト＋URLのみの通常共有→
   * クリップボードコピー＋画像ダウンロードの順でフォールバックする
   * （share.tsのshareResultWithImage()に集約。詳細はそちらのコメント参照）。
   * ユーザー自身が共有シートをキャンセルした場合（AbortError）はトーストを出さない。
   */
  async function handleShareImage() {
    if (!cardRef.current || imageBusy) return
    setImageBusy(true)
    try {
      const blob = await captureResultCardPng(cardRef.current)
      const outcome = await shareResultWithImage(blob, result.percent, result.type.name, result.finalTrial)
      if (outcome === 'fallback-copied') {
        showToast('画像付き共有に非対応の環境のため、画像を保存し共有文をコピーしました')
      } else if (outcome === 'shared-text-only') {
        showToast('この環境では画像を共有できないため、文章のみ共有しました（画像は「画像を保存」からどうぞ）')
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        showToast('共有に失敗しました。もう一度お試しください。')
      }
    } finally {
      setImageBusy(false)
    }
  }

  /** Ver.5.0追加: 「画像を保存」。共有せず、結果カードのPNGだけを端末へ保存する。 */
  async function handleSaveImage() {
    if (!cardRef.current || saveBusy) return
    setSaveBusy(true)
    try {
      const blob = await captureResultCardPng(cardRef.current)
      downloadPngBlob(blob)
      showToast('画像を保存しました')
    } catch {
      showToast('画像の保存に失敗しました。もう一度お試しください。')
    } finally {
      setSaveBusy(false)
    }
  }

  /** 「結果をコピー」は従来通り画像を含めず、共有文＋URLのテキストのみコピーする。 */
  const handleCopy = async () => {
    const ok = await copyShareText(result.percent, result.type.name, result.finalTrial)
    setCopied(ok)
    if (ok) setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex min-h-dvh flex-col items-center gap-5 px-6 py-8">
      {result.isNewBest && !result.isFirstPlay && (
        <p className="anim-pop rounded-full bg-amber-400/20 px-4 py-1.5 text-sm font-black text-amber-300">
          🎉 自己ベスト更新！
        </p>
      )}

      <ResultCard result={result} />

      {!result.isFirstPlay && (
        <div className="w-full max-w-xs space-y-1 rounded-2xl bg-white/5 px-4 py-3 text-sm">
          <div className="flex justify-between text-white/70">
            <span>今回</span>
            <span className="font-bold tabular-nums text-white">{result.percent}％</span>
          </div>
          <div className="flex justify-between text-white/70">
            <span>自己ベスト</span>
            <span className="font-bold tabular-nums text-white">{result.bestPercent}％</span>
          </div>
        </div>
      )}

      <div className="w-full max-w-xs space-y-2">
        <button
          onClick={handleShareImage}
          disabled={imageBusy}
          className="w-full rounded-2xl bg-white py-3.5 text-sm font-black text-[#1c1033] transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {imageBusy ? '画像を生成中…' : '🖼️ 画像付きでシェア'}
        </button>
        <button
          onClick={handleSaveImage}
          disabled={saveBusy}
          className="w-full rounded-2xl bg-white/10 py-3 text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {saveBusy ? '画像を生成中…' : '画像を保存'}
        </button>
        <button onClick={handleCopy} className="w-full rounded-2xl bg-white/5 py-2.5 text-xs font-bold text-white/60">
          {copied ? 'コピーしました！' : '結果をコピー'}
        </button>
        {toast && <p className="anim-pop text-center text-xs font-bold text-amber-200/90">{toast}</p>}
      </div>

      <button
        onClick={onRetry}
        className="mt-2 w-full max-w-xs rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-5 text-lg font-black text-white shadow-[0_8px_0_0_rgba(126,34,206,0.8)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(126,34,206,0.8)]"
      >
        {getRetryLabel(result.percent)}
      </button>

      {/*
        Ver.5.0追加修正: 共有PNG生成専用のoffscreen capture DOM。画面に表示されている
        ResultCardとは完全に別のDOMツリー（同じpropsで独立にレンダリングした複製）。
        以前はResultCard本体を画面上でpadding/negative marginのブリード枠に包んでいたが、
        そのnegative marginが実画面のflexレイアウトへ漏れ出し、カードの位置や下の
        「今回/自己ベスト」・ボタン群との間隔が崩れる不具合を引き起こした
        （実機で確認）。position:fixedで画面外（left:-9999px）へ完全に逃がすことで、
        実画面のレイアウトには一切干渉しない独立した構造にした。display:noneは
        使わない（レイアウトボックスを持たない要素はhtml-to-imageで正しく
        キャプチャできないため）。pointer-events:noneでユーザー操作の対象にもならない。
        widthは端末幅に関わらず常に320px固定（実画面のようにpx-6の余白と競合しない
        独立した領域のため、意図した完成サイズでそのまま書き出せる）。paddingは
        getCaptureBleedPx()でバリアントごとに必要最小限の値を割り当てる（詳細は同関数の
        コメント参照）。

        Ver.5.0追加修正: ここでレンダーするResultCardにだけforCapture={true}を渡す。
        実機（iPhone Safari）で共有PNGの右側に黒い矩形が写り込む不具合の原因が、
        ResultCard本体のoverflow-hidden+rounded-3xl+box-shadowの組み合わせ
        （border-radius＋overflow:hidden＋box-shadowを同一要素に持たせた場合の
        Safari/WebKit既知のレンダリング不具合パターン）と判明したため、共有PNG生成時
        だけbox-shadowを別要素へ分離する（詳細はResultCard.tsxのforCaptureコメント参照）。
        ライブ画面側（上のResultCard、forCapture未指定）の見た目・DOM構造は一切変えていない。
      */}
      <div aria-hidden="true" style={{ position: 'fixed', top: 0, left: -9999, pointerEvents: 'none' }}>
        <div
          ref={cardRef}
          style={{ width: 320, padding: getCaptureBleedPx(result.percent), backgroundColor: '#0b0620', boxSizing: 'content-box' }}
        >
          <ResultCard result={result} forCapture />
        </div>
      </div>
    </div>
  )
}
