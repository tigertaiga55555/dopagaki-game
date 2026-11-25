import { ENDLESS_DIFFICULTY_LABEL } from '../config/endlessConfig'
import { TITLE_TEXT } from '../config/messagesV4'
import { decodeResultSharePayload } from '../share/resultSharePayload'
import { resolveShareLandingDestination } from '../share/resultShareLanding'
import { sfx } from '../utils/sound'

interface Props {
  resultId: string
  onHome: () => void
  onStart: () => void
}

/**
 * 次フェーズ（ゲーム機能クローズラウンド、item 61-66）: X結果シェアURL（/s/:id）を開いた
 * 誰でも（アカウント不問）見られる着地画面。Challenge受信（screens/ChallengeReceiveScreen.tsx、
 * 「この記録を超えろ」という対戦の誘い）とは役割が違う——こちらは「この結果を見て／
 * ゲームを知って」という認知獲得専用で、対戦・挑戦の受諾導線は一切持たない。
 *
 * resultSharePayload.ts同様、サーバーへの問い合わせは一切行わない（URL自体に表示データが
 * 埋め込まれているため、静的なSPAルートとして完結する）。壊れた/改ざんされたIDは
 * 静かに「表示できませんでした」へフォールバックする（架空の結果をでっち上げて表示しない）。
 *
 * resolveShareLandingDestination()を呼ぶだけで、iOS化後のApp Store誘導／Universal Links
 * 判定を差し込める構造にしてある——今回は常に{kind:'web'}なので、このままこの画面を表示する。
 */
export function ResultShareLandingScreen({ resultId, onHome, onStart }: Props) {
  const destination = resolveShareLandingDestination()
  const payload = destination.kind === 'web' ? decodeResultSharePayload(resultId) : null

  if (!payload) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
        <p className="text-sm font-bold text-white/70">この結果は表示できませんでした。URLが正しいかご確認ください。</p>
        <button
          onClick={() => {
            sfx.navHome()
            onHome()
          }}
          className="rounded-2xl bg-white/10 px-6 py-3 text-sm font-bold text-white active:scale-95"
        >
          ホームへ戻る
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <p className="text-xs font-black tracking-[0.3em] text-fuchsia-300/90">RESULT</p>
      <h1 className="text-2xl font-black tracking-widest text-white">{TITLE_TEXT.heading}</h1>

      <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-3xl border border-fuchsia-400/25 bg-gradient-to-b from-white/[0.06] to-white/[0.02] px-6 py-8">
        {payload.mode === 'rush' ? (
          <>
            <p className="text-[10px] font-black tracking-widest text-white/40">DOPAGAKI度</p>
            <p className="text-5xl font-black tabular-nums text-amber-300">{payload.percent}％</p>
          </>
        ) : (
          <>
            <p className="text-[10px] font-black tracking-widest text-white/40">
              ENDLESS ・ {ENDLESS_DIFFICULTY_LABEL[payload.difficulty]}
            </p>
            <p className="text-5xl font-black tabular-nums text-amber-300">
              {payload.streak}
              <span className="ml-1 text-xl align-middle text-white/60">STREAK</span>
            </p>
          </>
        )}
      </div>

      {/* 次フェーズ（item 110）: 「お前」表現を削除し、自然な表現へ変更した。 */}
      <p className="text-sm font-bold text-white/70">{payload.mode === 'rush' ? 'あなたは何％までいける？' : 'あなたはどこまで続けられる？'}</p>

      <button
        onClick={() => {
          sfx.uiTap()
          onStart()
        }}
        className="w-full max-w-xs rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-4 text-base font-black tracking-widest text-white active:scale-95"
      >
        自分もプレイする
      </button>
      <button
        onClick={() => {
          sfx.navHome()
          onHome()
        }}
        className="w-full max-w-xs rounded-2xl bg-transparent py-2 text-sm font-bold text-white/50 active:scale-95"
      >
        ホームへ戻る
      </button>
    </div>
  )
}
