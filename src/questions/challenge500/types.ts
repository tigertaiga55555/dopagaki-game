import type { ComponentType } from 'react'

/**
 * Ver.6 Phase 1: 200〜500%「限界突破チャレンジ」専用の問題モジュール体系。
 * 既存のQuestionModule（通常0〜100%）・FinalQuestionModule（120〜200%）とは
 * 完全に別体系にしてある。このチャレンジはリアクション速度ではなく「問題文を
 * 正しく理解し、下線部分だけ反転させて読む」ことが核であるため、既存の
 * targetTimeMs（厳しい反応時間制限）の概念を持ち込まない方が適切なため。
 */
export type Challenge500Tier = 1 | 2 | 3

export interface Challenge500QuestionResult {
  correct: boolean
}

export interface Challenge500QuestionSpec {
  instanceId: string
  type: string
  data: Record<string, unknown>
}

export interface Challenge500QuestionComponentProps {
  spec: Challenge500QuestionSpec
  onResult: (result: Challenge500QuestionResult) => void
}

export interface Challenge500QuestionModule {
  id: string
  /** tierに応じて反転・条件数を変えたdataを生成する */
  generate: (tier: Challenge500Tier) => Record<string, unknown>
  Component: ComponentType<Challenge500QuestionComponentProps>
}
