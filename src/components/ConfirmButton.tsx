import { formatPoint } from '../utils/format'

interface Props {
  point: number
  onConfirm: () => void
}

export function ConfirmButton({ point, onConfirm }: Props) {
  return (
    <button
      onClick={onConfirm}
      className="w-full rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-5 text-lg font-black text-white shadow-[0_8px_0_0_rgba(126,34,206,0.8)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(126,34,206,0.8)]"
    >
      {formatPoint(point)} pt で確定する
    </button>
  )
}
