export type HomeModeId = 'rush' | 'endless' | 'battle'

export interface HomeModeDef {
  id: HomeModeId
  icon: string
  /** 英語タイトルを主役にする（実機QAで確定した最終名称）。 */
  titleEn: string
  /** 英語タイトルの下に置く短い日本語説明。初めて来た人でも何のモードか分かる長さに収める。 */
  subJa: string
  /** ボタンの主役色（グラデーション）。 */
  gradientClass: string
  /** 押し込み影＋発光感（drop-shadow的なglow）を1つのbox-shadowで表現する。 */
  shadowClass: string
}

/**
 * Ver.6 Phase 7（ホーム画面最終UI改善、実機QA確定）: ホーム画面の3モードの名称・配色。
 * 英語タイトルを主役にし、その下に短い日本語説明を添えることで、初めて来た人でも
 * 一瞬で「何のモードか」が分かるようにする。3モードが並んだときに「どれも主役級だが
 * 色で瞬時に判別できる」ことを狙い、以前より明るく・濃く・発光感のある配色にした
 * （薄い・淡い印象を減らす）。
 *
 * - 🔥 DOPA RUSH（旧「通常」）：紫〜ネオンパープル系。実機QAで赤系が試されたが、
 *   通常モードは従来の紫系の方がユーザー評価が高かったため、Phase 8で紫系へ戻した。
 * - ♾️ ENDLESS：黄色〜オレンジ〜金系。以前はトップ画面上で地味に見えていたため、
 *   3モード中もっとも目立つ配色にして良い、という明示指示に基づく。
 * - ⚔️ ONLINE BATTLE（旧「BATTLE」）：ユーザー評価の高い剣アイコン・赤〜ピンク系を維持。
 */
export const HOME_MODES: HomeModeDef[] = [
  {
    id: 'rush',
    icon: '🔥',
    titleEn: 'DOPA RUSH',
    subJa: '0%から500%を目指せ',
    gradientClass: 'bg-gradient-to-b from-fuchsia-500 to-purple-800',
    shadowClass: 'shadow-[0_8px_0_0_rgba(88,28,135,0.9),0_0_28px_4px_rgba(216,180,254,0.45)]',
  },
  {
    id: 'endless',
    icon: '♾️',
    titleEn: 'ENDLESS',
    subJa: '1ミスまで、どこまで続けられる？',
    gradientClass: 'bg-gradient-to-b from-amber-300 to-orange-600',
    shadowClass: 'shadow-[0_8px_0_0_rgba(154,52,18,0.9),0_0_28px_4px_rgba(251,191,36,0.45)]',
  },
  {
    id: 'battle',
    icon: '⚔️',
    titleEn: 'ONLINE BATTLE',
    subJa: '世界中のドパガキと1対1',
    gradientClass: 'bg-gradient-to-b from-rose-500 to-red-700',
    shadowClass: 'shadow-[0_8px_0_0_rgba(136,19,55,0.9),0_0_28px_4px_rgba(251,113,133,0.4)]',
  },
]
