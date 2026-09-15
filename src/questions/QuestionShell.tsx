import type { ReactNode } from 'react'

interface Props {
  instruction: string
  /**
   * 常時表示する小さな固定キャプション（任意）。ルールが状態によって切り替わる問題
   * （連打→急停止など）で、「今は何をする局面か」ではなく「ルールそのもの」を
   * 出題中ずっと見せておきたい場合に使う。
   */
  sub?: string
  children: ReactNode
}

/** 全お題共通の外枠。お題文を大きく、選択肢は下に。 */
export function QuestionShell({ instruction, sub, children }: Props) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 px-6 py-4 text-center select-none">
      <div className="flex flex-col items-center gap-1">
        {sub && <p className="text-xs font-bold tracking-wide text-white/50">{sub}</p>}
        <p className="whitespace-pre-line text-3xl font-black leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
          {instruction}
        </p>
      </div>
      {children}
    </div>
  )
}
