import { useState } from 'react'
import { ResultCard } from '../components/ResultCard'
import { NEW_HIGH_SCORE_MESSAGE, NEW_LOW_MESSAGE, buildRetryLabel } from '../config/messagesV3'
import { copyShareText, getLineShareUrl, getXShareUrl, shareResult } from '../utils/share'
import type { FinalResult } from '../types'

interface Props {
  result: FinalResult
  onRetry: () => void
}

const canNativeShare = typeof navigator !== 'undefined' && Boolean((navigator as Navigator & { share?: unknown }).share)

export function ResultScreen({ result, onRetry }: Props) {
  const [copied, setCopied] = useState(false)
  const topCrime = result.crimeRecords[0]

  const handleNativeShare = () => {
    void shareResult(result.dopagakiPercent, result.type.name, result.gameScore, topCrime)
  }

  const handleCopy = async () => {
    const ok = await copyShareText(result.dopagakiPercent, result.type.name, result.gameScore, topCrime)
    setCopied(ok)
    if (ok) setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex min-h-dvh flex-col items-center gap-5 px-6 py-8">
      {(result.isNewLowDopagaki || result.isNewHighScore) && !result.isFirstPlay && (
        <div className="flex flex-col items-center gap-1.5">
          {result.isNewLowDopagaki && (
            <p className="anim-pop rounded-full bg-amber-400/20 px-4 py-1.5 text-sm font-black text-amber-300">
              🎉 {NEW_LOW_MESSAGE}
            </p>
          )}
          {result.isNewHighScore && (
            <p className="anim-pop rounded-full bg-sky-400/20 px-4 py-1.5 text-sm font-black text-sky-300">
              🏆 {NEW_HIGH_SCORE_MESSAGE}
            </p>
          )}
        </div>
      )}

      <ResultCard result={result} />

      {!result.isFirstPlay && (
        <div className="w-full max-w-xs space-y-2 rounded-2xl bg-white/5 px-4 py-3 text-sm">
          <div className="flex justify-between text-white/70">
            <span>GAME SCORE 今回</span>
            <span className="font-bold tabular-nums text-white">{result.gameScore.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-white/70">
            <span>BEST</span>
            <span className="font-bold tabular-nums text-white">{result.bestGameScore.toLocaleString()}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-white/10 pt-2 text-white/70">
            <span>ドパガキ度 今回</span>
            <span className="font-bold tabular-nums text-white">{result.dopagakiPercent}％</span>
          </div>
          <div className="flex justify-between text-white/70">
            <span>自己最低</span>
            <span className="font-bold tabular-nums text-white">{result.lowestDopagaki}％</span>
          </div>
        </div>
      )}

      <div className="w-full max-w-xs space-y-2">
        {canNativeShare ? (
          <button onClick={handleNativeShare} className="w-full rounded-2xl bg-white/10 py-3.5 text-sm font-bold text-white">
            結果をシェアする
          </button>
        ) : (
          <div className="flex gap-2">
            <a
              href={getXShareUrl(result.dopagakiPercent, result.type.name, result.gameScore, topCrime)}
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
              href={getLineShareUrl(result.dopagakiPercent, result.type.name, result.gameScore, topCrime)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-2xl bg-white/10 py-3.5 text-center text-sm font-bold text-white"
            >
              LINEでシェア
            </a>
          </div>
        )}
        <button onClick={handleCopy} className="w-full rounded-2xl bg-white/5 py-2.5 text-xs font-bold text-white/60">
          {copied ? 'コピーしました！' : '結果テキストをコピー'}
        </button>
      </div>

      <button
        onClick={onRetry}
        className="mt-2 w-full max-w-xs rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-5 text-lg font-black text-white shadow-[0_8px_0_0_rgba(126,34,206,0.8)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(126,34,206,0.8)]"
      >
        {buildRetryLabel(result.playCount, result.lowestDopagaki, result.bestGameScore)}
      </button>
    </div>
  )
}
