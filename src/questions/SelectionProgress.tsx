interface Props {
  done: number
  total: number
}

/**
 * Ver.6 Phase 7（ホーム/ENDLESS実機QA最終改善）: 複数選択問題（順不同）で「あと何個選ぶか」を
 * 小さく示す共通表示。問題文（QuestionShellのinstruction）より目立たせないよう、
 * 常にtext-xs・白の低不透明度に固定する。通常/500% LIMIT BREAK/ENDLESS/Challenge/Battleの
 * どの出題元からでも同じ見た目になる、問題コンポーネント側の共通部品。
 */
export function SelectionProgress({ done, total }: Props) {
  return (
    <p className="text-xs font-bold tabular-nums text-white/50" aria-live="polite">
      選択 {done} / {total}
    </p>
  )
}
