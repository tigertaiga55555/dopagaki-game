export interface PromptSegment {
  text: string
  /** trueの場合、下線を引いて「反対の意味で読め」と示す */
  inverted: boolean
}

interface Props {
  segments: PromptSegment[]
}

/**
 * Ver.6 Phase 1: 200〜499%「下線反転」ギミックの核となる表示コンポーネント。
 * 下線が引かれた部分だけ、反対の意味として読む、というルールをUI上で一貫して
 * 伝えるため、全テンプレート共通でこのコンポーネントだけを使って問題文を描画する。
 * 色は一切使わず、下線という明確な意味を持つUIだけで反転箇所を示す。
 */
export function InversionPrompt({ segments }: Props) {
  return (
    <p className="whitespace-pre-line text-2xl font-black leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
      {segments.map((seg, i) => (
        <span key={i} className={seg.inverted ? 'underline decoration-4 underline-offset-4' : undefined}>
          {seg.text}
        </span>
      ))}
    </p>
  )
}
