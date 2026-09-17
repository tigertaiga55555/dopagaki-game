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
        独立した領域のため、意図した完成サイズでそのまま書き出せる）。

        Ver.5.0追加修正: paddingは32→140pxへ拡大した。ResultCardのbox-shadow
        グロー（isMax=110pxブラー、OVERDRIVE=60pxブラー、通常=下方向40pxブラー＋
        20pxオフセット）は要素自身のborder boxの外側へ描画されるが、旧padding=32では
        いずれのブラー半径よりも小さく、キャプチャ矩形の端でグローが完全にフェード
        しきる前に切り取られていた（実機で「金色の縁が中途半端にはみ出て見える」
        「途中で切れたgold border」として報告）。全バリアント中最大のisMaxの
        ブラー半径110pxに十分な余裕（+約30px）を持たせた140pxへ統一することで、
        どのスコア帯でもグローがキャプチャ矩形内で完全に減衰してから端に達するようにし、
        非対称な切れ目が出ないようにした（ライブ画面側のResultCard自体・box-shadow値は
        一切変更していない。影響はこのoffscreen capture用ラッパーのpaddingのみ）。
      */}
      <div aria-hidden="true" style={{ position: 'fixed', top: 0, left: -9999, pointerEvents: 'none' }}>
        <div ref={cardRef} style={{ width: 320, padding: 140, backgroundColor: '#0b0620', boxSizing: 'content-box' }}>
          <ResultCard result={result} />
        </div>
      </div>
    </div>
  )
}
