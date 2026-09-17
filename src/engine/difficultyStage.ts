/**
 * Ver.4.5: 一部お題（信号連打など）が「今どのくらいゲームが進行しているか」を
 * generate()から参照できるようにするための、軽量な共有ステージ値。
 * QuestionModuleのインターフェースは変えず、bgm.tsのsetBgmProgressと同様に
 * モジュールレベルの値をuseRushGameのtickから更新する形にしている。
 */
let stageIndex = 0

/** stage: 0〜5（difficultyConfig.tsのフェーズ番号と対応） */
export function setCurrentStageIndex(stage: number): void {
  stageIndex = stage
}

export function getCurrentStageIndex(): number {
  return stageIndex
}
