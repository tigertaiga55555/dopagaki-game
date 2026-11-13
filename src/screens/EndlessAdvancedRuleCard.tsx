import { useState } from 'react'
import { InversionPrompt } from '../components/InversionPrompt'
import { opposite } from '../engine/inversion/words'
import { hasSeenEndlessAdvancedRule, markEndlessAdvancedRuleSeen } from '../utils/storage'

interface Props {
  onContinue: () => void
}

/**
 * Ver.6 Phase 7（ENDLESS上級の開始前ルール説明、実機QA確定）: 上級特有の「下線が付いた
 * 部分は指示を逆にする」というルールを、開始前に必ず1度は見せる。実例は
 * components/InversionPrompt（下線反転ギミックの本物の表示コンポーネント）と
 * engine/inversion/words.tsのopposite()関数をそのまま使って作る——手書きの簡略化例では
 * なく、実際の上級問題（src/questions/challenge500/*）が使っているのと全く同じ部品・
 * 同じ関数で例を構成するため、仕様とのズレが構造的に起こり得ない。
 *
 * 初回（localStorageにhasSeenEndlessAdvancedRuleが無い）は実例を最初から展開表示。
 * 2回目以降は1行の短い確認文だけにして、必要なら「ルールを見る」で同じ実例を
 * 展開できる（毎回長いチュートリアルを強制しない。テンポよくSTARTへ進める）。
 */
export function EndlessAdvancedRuleCard({ onContinue }: Props) {
  const [expanded, setExpanded] = useState(() => !hasSeenEndlessAdvancedRule())

  const shownWord = '右'
  const correctWord = opposite('leftRight', shownWord)

  function handleContinue() {
    markEndlessAdvancedRuleSeen()
    onContinue()
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-black px-6 py-10 text-center">
      <p className="text-xs font-black tracking-[0.3em] text-red-300">⚠️ 上級ルール</p>
      <p className="text-lg font-bold leading-relaxed text-white/90">
        下線が付いた部分は、
        <br />
        指示を逆にする
      </p>

      {!expanded && (
        <button onClick={() => setExpanded(true)} className="text-xs font-bold text-white/50 underline underline-offset-4">
          ルールを見る（実例つき）
        </button>
      )}

      {expanded && (
        <div className="flex w-full max-w-xs flex-col items-center gap-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-6">
          <InversionPrompt segments={[{ text: shownWord, inverted: true }, { text: 'を押せ！', inverted: false }]} />
          <div className="flex items-center gap-3 text-sm font-bold text-white/70">
            <span>
              下線の「{shownWord}」は逆の意味 → 正解は「<span className="text-red-300">{correctWord}</span>」
            </span>
          </div>
          <div className="flex gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-red-400 bg-red-500/30 text-xl font-black text-white">
              {correctWord} ✓
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-xl font-black text-white/40">
              {shownWord}
            </div>
          </div>
          <p className="text-[11px] font-bold text-white/40">（下線なしの指示はそのままの意味で読む）</p>
        </div>
      )}

      <button
        onClick={handleContinue}
        className="w-full max-w-xs rounded-2xl bg-gradient-to-b from-red-500 to-red-800 py-4 text-lg font-black tracking-widest text-white shadow-[0_6px_0_0_rgba(127,29,29,0.9)] transition-transform active:translate-y-1 active:shadow-none"
      >
        START
      </button>
    </div>
  )
}
