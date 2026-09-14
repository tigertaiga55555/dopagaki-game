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
}

/** 100%超え（OVERDRIVE）の称号。percentの範囲で決まる。 */
export const OVERDRIVE_TITLES: { max: number; type: DopagakiTypeDef }[] = [
  { max: 105, type: { id: 'overdrive1', name: '限界突破ドパガキ' } },
  { max: 110, type: { id: 'overdrive2', name: '刺激過剰摂取型ドパガキ' } },
  { max: 115, type: { id: 'overdrive3', name: 'ドーパミン暴走型' } },
  { max: 119, type: { id: 'overdrive4', name: '人類卒業型ドパガキ' } },
  { max: 120, type: { id: 'overdrive5', name: 'ドパガキ最終形態' } },
]

export function getOverdriveTitle(percent: number): DopagakiTypeDef {
  for (const tier of OVERDRIVE_TITLES) {
    if (percent <= tier.max) return tier.type
  }
  return OVERDRIVE_TITLES[OVERDRIVE_TITLES.length - 1].type
}
