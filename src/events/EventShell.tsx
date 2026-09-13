import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
}

/** 全イベント共通の外枠。中央寄せ・縦画面・片手操作を前提にしたレイアウト。 */
export function EventShell({ children, className = '' }: Props) {
  return (
    <div className={`flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-6 px-6 py-6 text-center ${className}`}>
      {children}
    </div>
  )
}
