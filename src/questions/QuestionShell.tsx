import type { ReactNode } from 'react'

interface Props {
  instruction: string
  children: ReactNode
}

/** 全お題共通の外枠。お題文を大きく、選択肢は下に。 */
export function QuestionShell({ instruction, children }: Props) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 px-6 py-4 text-center select-none">
      <p className="whitespace-pre-line text-3xl font-black leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
        {instruction}
      </p>
      {children}
    </div>
  )
}
