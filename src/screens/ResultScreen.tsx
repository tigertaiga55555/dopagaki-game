import { useEffect, useRef, useState } from 'react'
import { ResultCard } from '../components/ResultCard'
import { FINAL_TRIAL_CONFIG } from '../config/finalTrialConfig'
import { getRetryLabel } from '../config/messagesV4'
import { trackResultView, trackShareClick } from '../utils/analytics'
import { captureResultCardPng, downloadPngBlob } from '../utils/shareImage'
import { copyShareText, shareResultWithImage } from '../utils/share'
import { sfx } from '../utils/sound'
import type { FinalResultV4 } from '../types'

interface Props {
  result: FinalResultV4
  onRetry: () => void
}

const TOAST_MS = 3200

export function ResultScreen({ result, onRetry }: Props) {
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

  // Ver.5.0追加: GA4のresult_viewを結果画面表示のたびに一度だけ送信する。
  useEffect(() => {
    trackResultView(result.percent)
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
   * Ver.5.0追加: 「画像付きでシェア」。resultデータからCanvas 2Dで共有PNGを直接描画し
   * （shareImage.ts→shareCanvas.ts、DOMキャプチャは経由しない）、Web Share API
   * （ファイル共有対応環境）→テキスト＋URLのみの通常共有→クリップボードコピー＋
   * 画像ダウンロードの順でフォールバックする（share.tsのshareResultWithImage()に集約）。
   * ユーザー自身が共有シートをキャンセルした場合（AbortError）はトーストを出さない。
   */
  async function handleShareImage() {
    if (imageBusy) return
    trackShareClick()
    setImageBusy(true)
    try {
      const blob = await captureResultCardPng(result)
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
    if (saveBusy) return
    setSaveBusy(true)
    try {
      const blob = await captureResultCardPng(result)
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
    </div>
  )
}
