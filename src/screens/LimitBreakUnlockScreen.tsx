import { QuitButton } from '../components/QuitButton'

interface Props {
  onQuit: () => void
}

/**
 * Ver.6 Phase 1（再設計版）: 200% PERFECT CLEARの祝福が完全に終わった後、500%
 * チャレンジの説明画面へ入る前に必ず一度だけ挟む「まだ先がある」ムード転換〜
 * LIMIT BREAK解放の短い演出。FinalTrialScreen（本番の到達経路）とQAプレビュー画面
 * （Challenge500QaPreviewScreen、演出だけを単独で見返すため）の両方から同じ
 * コンポーネントを再利用する——演出を複製しない。
 *
 * このコンポーネント自体は自動で次の画面へ進む機能を持たない（「いつ・何秒で次へ
 * 進むか」は呼び出し元がそれぞれ管理する）。SE（sfx.limitBreakUnlock）の再生も
 * 呼び出し元の責務とする（Preview単独再生時に毎回鳴らしたい/鳴らしたくない、を
 * 呼び出し元が選べるようにするため）。
 */
export function LimitBreakUnlockScreen({ onQuit }: Props) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <QuitButton onQuit={onQuit} />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="anim-pop text-base font-black tracking-widest text-white/50">200%を超えて、</p>
        <p className="anim-pop text-2xl font-black tracking-widest text-white" style={{ animationDelay: '0.5s' }}>
          まだ先がある……
        </p>
        <p
          className="anim-pop bg-gradient-to-b from-fuchsia-300 to-purple-400 bg-clip-text text-4xl font-black tracking-tight text-transparent"
          style={{ animationDelay: '1.3s' }}
        >
          LIMIT BREAK
        </p>
      </div>
    </div>
  )
}
