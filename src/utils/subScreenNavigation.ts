/**
 * 次フェーズ（Profile/Heart UI強化ラウンド、item 17/18）: Achievement/Ranking/
 * 作成したChallenge/参加したChallengeの4画面は、Profileからも・Home（title画面の
 * サブ導線）からも直接開ける。「戻る」は常にHomeへ固定せず、実際にどこから開いたかに
 * 応じてProfile/Homeのどちらかへ正しく戻す（item 18のユーザー指示：重要）。
 *
 * ブラウザのhistoryには一切依存せず（ユーザー指示：不安定なため避ける）、App.tsx内の
 * 既存のscreen状態モデルに「どこから開いたか」を1つの状態（SubScreenOrigin）として
 * 素直に持たせるだけで実現する。この判定・戻り先のラベル決定だけを純粋関数として
 * 切り出し、DOM/Reactに依存しないため直接vitestで検証できる。
 */
export type SubScreenOrigin = 'title' | 'profile'

export interface SubScreenBackTarget {
  screen: SubScreenOrigin
  label: string
}

/** 4画面を開いた瞬間の現在画面から、戻り先を判定する。Profileから開いた場合のみ'profile'。 */
export function resolveSubScreenOrigin(currentScreen: string): SubScreenOrigin {
  return currentScreen === 'profile' ? 'profile' : 'title'
}

/** 戻り先のscreenと、BackButtonに渡すlabel（「← プロフィール」/「← ホーム」）を返す。 */
export function getSubScreenBackTarget(origin: SubScreenOrigin): SubScreenBackTarget {
  if (origin === 'profile') return { screen: 'profile', label: 'プロフィール' }
  return { screen: 'title', label: 'ホーム' }
}
