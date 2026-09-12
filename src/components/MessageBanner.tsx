interface Props {
  message: string
  effectKey: number
}

export function MessageBanner({ message, effectKey }: Props) {
  return (
    <div className="flex h-14 items-center justify-center px-4 text-center">
      {message && (
        <p
          key={effectKey}
          className="anim-pop rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white/90 backdrop-blur-sm"
        >
          {message}
        </p>
      )}
    </div>
  )
}
