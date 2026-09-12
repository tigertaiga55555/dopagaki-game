import { useState } from 'react'
import { ResultCard } from '../components/ResultCard'
import { AUTO_END_MESSAGE, NEW_BEST_MESSAGE } from '../config/messages'
import { formatPoint } from '../utils/format'
import { copyShareText, getLineShareUrl, getXShareUrl, shareResult } from '../utils/share'
import type { GameResult } from '../types'

interface Props {
  result: GameResult
  onRetry: () => void
}

const canNativeShare = typeof navigator !== 'undefined' && Boolean((navigator as Navigator & { share?: unknown }).share)

export function ResultScreen({ result, onRetry }: Props) {
  const [copied, setCopied] = useState(false)

  const handleNativeShare = () => {
    void shareResult(result.finalPoint, result.dopagakiPercent, result.rank.name)
  }

  const handleCopy = async () => {
    const ok = await copyShareText(result.finalPoint, result.dopagakiPercent, result.rank.name)
    setCopied(ok)
    if (ok) setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex min-h-dvh flex-col items-center gap-5 px-6 py-8">
      {result.isNewBest && (
        <p className="anim-pop rounded-full bg-amber-400/20 px-4 py-1.5 text-sm font-black text-amber-300">
          🎉 {NEW_BEST_MESSAGE}
        </p>
      )}
      {result.isAuto && (
        <p className="text-center text-xs font-bold text-white/50">{AUTO_END_MESSAGE}</p>
      )}

      <ResultCard result={result} />

      <div className="w-full max-w-xs space-y-1 rounded-2xl bg-white/5 px-4 py-3 text-sm">
        <div className="flex justify-between text-white/70">
          <span>今回の最高到達</span>
          <span className="font-bold tabular-nums text-white">
            {formatPoint(result.maxPoint)} pt
          </span>
        </div>
        <div className="flex justify-between text-white/70">
          <span>自己ベスト</span>
          <span className="font-bold tabular-nums text-white">
            {formatPoint(result.bestPoint)} pt
          </span>
        </div>
      </div>

      <div className="w-full max-w-xs space-y-2">
        {canNativeShare ? (
          <button
            onClick={handleNativeShare}
            className="w-full rounded-2xl bg-white/10 py-3.5 text-sm font-bold text-white"
          >
            結果をシェアする
          </button>
        ) : (
          <div className="flex gap-2">
            <a
              href={getXShareUrl(result.finalPoint, result.dopagakiPercent, result.rank.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-white/10 py-3.5 text-center text-sm font-bold text-white"
            >
              <svg className="h-3.5 w-3.5 fill-white" viewBox="0 0 19 19" aria-hidden="true">
                <use href="/icons.svg#x-icon" />
              </svg>
              Xでシェア
            </a>
            <a
              href={getLineShareUrl(result.finalPoint, result.dopagakiPercent, result.rank.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-2xl bg-white/10 py-3.5 text-center text-sm font-bold text-white"
            >
              LINEでシェア
            </a>
          </div>
        )}
        <button
          onClick={handleCopy}
          className="w-full rounded-2xl bg-white/5 py-2.5 text-xs font-bold text-white/60"
        >
          {copied ? 'コピーしました！' : '結果テキストをコピー'}
        </button>
      </div>

      <button
        onClick={onRetry}
        className="mt-2 w-full max-w-xs rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-5 text-lg font-black text-white shadow-[0_8px_0_0_rgba(126,34,206,0.8)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(126,34,206,0.8)]"
      >
        もう一回我慢する
      </button>
    </div>
  )
}
