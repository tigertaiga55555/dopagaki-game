import { NavBar } from '../../components/NavBar'

interface Props {
  onBack: () => void
  onHome: () => void
  onWorldBattle: () => void
  /** 次フェーズ（DOPA PASS基盤ラウンド、item 15 PRIVATE ROOM）: 参加は誰でも無料、作成はDOPA PASS限定。 */
  onPrivateRoom: () => void
}

/**
 * Ver.6 Phase 6（1対1リアルタイム対戦）: BATTLE → 対戦方法の選択画面。
 * 通常モードより対人戦・緊張感・アーケード感を出すため、濃い赤〜紫のグラデーションで
 * トーンを変える（ただし問題の視認性には影響しない、この画面限定の演出）。
 *
 * 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 25/26）: 「知らない人とのランダムマッチング＝
 * World Battle」「友達との対戦＝PRIVATE ROOM」に役割を完全分離するため、スタンドアロンの
 * 🤝フレンド対戦（ルームコード/URLで誰でも無料に1対1を始められる導線）をここから廃止した
 * ——これを残したままだとDOPA PASSの一番の訴求点（PRIVATE ROOM作成権）が無料の代替手段で
 * 迂回されてしまう（item 36）。選択肢は常に世界対戦／PRIVATE ROOMの2つだけになる。
 *
 * 内部実装注記（最終報告書にも記載）: BattleMode型の'friend'や、既存のBattleRoom DO・
 * battleRoomEngine.ts・/api/battles/rooms系のHTTPルートは一切削除していない——PRIVATE ROOMの
 * NORMAL対戦が既にmode:'friend'としてこれらをそのまま再利用しているため（内部名を'private'へ
 * 改名することも検討したが、BattleMode型・各テスト・Worker側ルーティングなど影響範囲が
 * 広く、今回のラウンドでの機能的な利益がないため見送った——判断の根拠として記録する）。
 *
 * 次フェーズ（FRIENDS/TABLE/ナビ追加調整ラウンド、item 42）: ユーザー向け表示は
 * 「🤝 友達と対戦」へ改名した（"PRIVATE ROOM"という内部コード名はデータモデル・
 * ファイル名としては引き続き使うが、画面上には一切出さない）。
 */
export function BattleHomeScreen({ onBack, onHome, onWorldBattle, onPrivateRoom }: Props) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-gradient-to-b from-black via-[#1a0510] to-black">
      <NavBar onBack={onBack} onHome={onHome} />

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
            onClick={onPrivateRoom}
            className="mt-2 w-full rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/10 py-4 text-base font-black tracking-widest text-fuchsia-200 transition-transform active:scale-95"
          >
            🤝 友達と対戦
          </button>
          <p className="text-[11px] text-white/40">最大8人で集まって何度でも対戦</p>
        </div>
      </div>
    </div>
  )
}
