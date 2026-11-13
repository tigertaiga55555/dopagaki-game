import { BackButton } from '../../components/BackButton'

interface Props {
  onBack: () => void
  onWorldBattle: () => void
  onFriendBattle: () => void
}

/**
 * Ver.6 Phase 6（1対1リアルタイム対戦）: BATTLE → 世界対戦/フレンド対戦の選択画面。
 * 通常モードより対人戦・緊張感・アーケード感を出すため、濃い赤〜紫のグラデーションで
 * トーンを変える（ただし問題の視認性には影響しない、この画面限定の演出）。
 */
export function BattleHomeScreen({ onBack, onWorldBattle, onFriendBattle }: Props) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-gradient-to-b from-black via-[#1a0510] to-black">
      <BackButton onBack={onBack} label="ホーム" />

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-10 text-center">
        <p className="text-xs font-black tracking-[0.4em] text-rose-400/80">1 vs 1 REAL-TIME</p>
        <h1 className="text-4xl font-black tracking-widest text-white drop-shadow-[0_0_20px_rgba(244,63,94,0.5)]">BATTLE</h1>

        <div className="flex w-full max-w-xs flex-col gap-4">
          <button
            onClick={onWorldBattle}
            className="w-full rounded-2xl bg-gradient-to-b from-rose-500 to-red-700 py-5 text-lg font-black tracking-widest text-white shadow-[0_6px_0_0_rgba(136,19,55,0.9)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(136,19,55,0.9)]"
          >
            🌐 世界対戦
          </button>
          <p className="text-[11px] text-white/40">知らないプレイヤーとランダムマッチング</p>

          <button
            onClick={onFriendBattle}
            className="mt-2 w-full rounded-2xl border border-white/15 bg-white/5 py-4 text-base font-black tracking-widest text-white/85 transition-transform active:scale-95"
          >
            🤝 フレンド対戦
          </button>
          <p className="text-[11px] text-white/40">URL・ルームコードで1対1</p>
        </div>
      </div>
    </div>
  )
}
