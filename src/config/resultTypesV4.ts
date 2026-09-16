import type { DopagakiTypeDef } from '../types'

/** 通常プレイ（0〜100%）のタイプ名。あとから配列に追加していける構造。 */
export const NORMAL_TYPES = {
  novice: { id: 'novice', name: 'ドパガキ見習い' } satisfies DopagakiTypeDef,
  speed: { id: 'speed', name: '脳直高速処理型ドパガキ' } satisfies DopagakiTypeDef,
  repeatTap: { id: 'repeatTap', name: '連打中毒型ドパガキ' } satisfies DopagakiTypeDef,
  swipe: { id: 'swipe', name: '高速フリック型ドパガキ' } satisfies DopagakiTypeDef,
  impatient: { id: 'impatient', name: '待てない型ドパガキ' } satisfies DopagakiTypeDef,
  machine: { id: 'machine', name: '刺激処理マシーン' } satisfies DopagakiTypeDef,
  complete: { id: 'complete', name: '完全体ドパガキ' } satisfies DopagakiTypeDef,
  /**
   * どの特徴も突出しなかった場合の汎用タイプ。「なんとなく高速型」のような誤判定を避けるための
   * 受け皿だが、Ver.4.9で「バランス型」から改名：無難すぎてシェアしたくなる名前ではなかったため、
   * 世界観に合う名前に変更した。
   */
  balanced: { id: 'balanced', name: '野生型ドパガキ' } satisfies DopagakiTypeDef,
}

/**
 * タイプ判定の閾値。Ver.4では反応時間/制限時間の比率だけで緩く判定していたため、
 * 「最速反応0.73秒でも脳直高速処理型」のような誤判定が起きていた。
 * Ver.4.1では最低サンプル数・絶対時間・正答率の3条件を組み合わせて厳格化する。
 */
export const TYPE_THRESHOLDS = {
  /** speed/machine判定に必要な「お題系」問題の最低サンプル数 */
  minSamplesForSpecialType: 5,
  speed: {
    /** 反応時間/制限時間比率の上限 */
    maxAvgRatio: 0.42,
    /** 平均反応時間(ms)の絶対上限。比率だけでなく実際の速さも要求する */
    maxAvgReactionMs: 480,
    minAccuracy: 0.8,
  },
  repeatTap: {
    minSamples: 3,
    minAccuracy: 0.75,
  },
  swipe: {
    minSamples: 3,
    minAccuracy: 0.75,
  },
  impatient: {
    minNoPressTotal: 2,
    minFailRate: 0.5,
    /** Ver.4.2: GO/SKIPフライング＋指定回数オーバーの合計がこの値以上でも待てない型（もう1つの経路） */
    minImpulseEvents: 3,
  },
  machine: {
    minAccuracy: 0.88,
    maxAvgRatio: 0.38,
  },
  noviceMaxPercent: 40,
}

/**
 * 100%超え（OVERDRIVE）の称号。percentの範囲で決まる。
 * Ver.4.9: 120%はゲーム開始から完全ノーミスでしか到達できない別格の条件になったため、
 * 通常のOVERDRIVE称号（101〜119）とはっきり区別できる名前にした。
 *
 * Ver.5.0: 120%はもはや「完全攻略」ではなく、FINAL DOPA TRIALへの入口になった。
 * 「PERFECT CLEAR」「DOPA PERFECT」「完全攻略」の表現は200%（FINAL QUESTION正解）だけの
 * 専用表現とし、120〜199（FINAL DOPA TRIAL挑戦中・途中失敗を含む）には別の称号を割り当てる。
 */
export const OVERDRIVE_TITLES: { max: number; type: DopagakiTypeDef }[] = [
  { max: 105, type: { id: 'overdrive1', name: '限界突破ドパガキ' } },
  { max: 110, type: { id: 'overdrive2', name: '刺激過剰摂取型ドパガキ' } },
  { max: 115, type: { id: 'overdrive3', name: 'ドーパミン暴走型' } },
  { max: 119, type: { id: 'overdrive4', name: '人類卒業型ドパガキ' } },
  { max: 199, type: { id: 'finalTrial', name: 'FINAL DOPA TRIAL挑戦者' } },
  { max: 200, type: { id: 'dopaPerfect', name: 'DOPA PERFECT' } },
]

export function getOverdriveTitle(percent: number): DopagakiTypeDef {
  for (const tier of OVERDRIVE_TITLES) {
    if (percent <= tier.max) return tier.type
  }
  return OVERDRIVE_TITLES[OVERDRIVE_TITLES.length - 1].type
}
