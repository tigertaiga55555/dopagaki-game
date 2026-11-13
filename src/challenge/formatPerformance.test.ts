import { describe, expect, it } from 'vitest'
import { BASE_DOPA_PERCENT_NOTE, describeDecidedBy, formatAccuracyPercent, formatReactionSeconds, resultForViewer } from './formatPerformance'

/**
 * Ver.6 Phase 5.4（実機QA最終修正）: D1上のchallenge_attempts.resultは常に挑戦者視点で
 * 保存されている。resultForViewer/describeDecidedByは、表示直前にだけ視点に応じて
 * 反転する純粋関数——DBの値そのものは一切書き換えない、という重要事項を検証する。
 */
describe('resultForViewer', () => {
  it('challenger視点はそのまま返す（反転しない）', () => {
    expect(resultForViewer('win', 'challenger')).toBe('win')
    expect(resultForViewer('lose', 'challenger')).toBe('lose')
  })

  it('host視点は反転する: 挑戦者WIN → ホストLOSE', () => {
    expect(resultForViewer('win', 'host')).toBe('lose')
  })

  it('host視点は反転する: 挑戦者LOSE → ホストWIN', () => {
    expect(resultForViewer('lose', 'host')).toBe('win')
  })

  it('Ver.6 Phase 8: DRAWはどちらの視点でもDRAWのまま（反転しない）', () => {
    expect(resultForViewer('draw', 'challenger')).toBe('draw')
    expect(resultForViewer('draw', 'host')).toBe('draw')
  })
})

describe('describeDecidedBy', () => {
  it('挑戦者視点: 通常獲得DOPA%でWIN（challengerResult=winのまま）', () => {
    expect(describeDecidedBy('baseDopaPercent', 'win', 'challenger')).toBe('通常獲得DOPA%でWIN')
  })

  it('ホスト視点: 同じ試合（挑戦者WIN）でも、ホストにとっては通常獲得DOPA%でLOSEになる', () => {
    expect(describeDecidedBy('baseDopaPercent', 'win', 'host')).toBe('通常獲得DOPA%でLOSE')
  })

  it('挑戦者視点: 挑戦者LOSEならLOSE表記', () => {
    expect(describeDecidedBy('accuracy', 'lose', 'challenger')).toBe('正答率でLOSE')
  })

  it('ホスト視点: 挑戦者LOSEならホストはWIN表記になる', () => {
    expect(describeDecidedBy('accuracy', 'lose', 'host')).toBe('正答率でWIN')
  })

  it('decidedBy（勝敗を決めた項目）自体は視点によらず同じ事実を指す', () => {
    const challengerText = describeDecidedBy('maxCombo', 'win', 'challenger')
    const hostText = describeDecidedBy('maxCombo', 'win', 'host')
    expect(challengerText).toContain('最大COMBO')
    expect(hostText).toContain('最大COMBO')
  })

  it('Ver.6 Phase 8: exactTieはどちらの視点でも「完全同値のためDRAW」（ホスト防衛の表現は廃止）', () => {
    expect(describeDecidedBy('exactTie', 'draw', 'challenger')).toBe('完全同値のためDRAW')
    expect(describeDecidedBy('exactTie', 'draw', 'host')).toBe('完全同値のためDRAW')
  })

  it('Ver.6 Phase 8: ENDLESS Challengeのstreakタイ（同STREAK数）も視点によらず同じDRAW表記になる', () => {
    expect(describeDecidedBy('streak', 'draw', 'challenger')).toBe('連続正解数が同数のためDRAW')
    expect(describeDecidedBy('streak', 'draw', 'host')).toBe('連続正解数が同数のためDRAW')
  })

  it('legacyScoreOnly: 視点に応じて反転する（旧Challengeへの挑戦でも同じ規則）', () => {
    expect(describeDecidedBy('legacyScoreOnly', 'win', 'challenger')).toBe('記録(DOPA%)でWIN')
    expect(describeDecidedBy('legacyScoreOnly', 'win', 'host')).toBe('記録(DOPA%)でLOSE')
  })
})

describe('formatAccuracyPercent / formatReactionSeconds（既存の表示整形、perspectiveの影響を受けない）', () => {
  it('formatAccuracyPercent: 0.544 → 54%', () => {
    expect(formatAccuracyPercent(0.544)).toBe('54%')
  })

  it('formatReactionSeconds: 710ms → 0.71秒、nullは—', () => {
    expect(formatReactionSeconds(710)).toBe('0.71秒')
    expect(formatReactionSeconds(null)).toBe('—')
  })
})

describe('BASE_DOPA_PERCENT_NOTE（通常獲得DOPA%の意味を示す補足文、Challenge作成完了/結果比較/履歴・詳細の各画面で表示する）', () => {
  it('ボーナス加算分を除いた値であることを明示する文言になっている', () => {
    expect(BASE_DOPA_PERCENT_NOTE).toContain('通常獲得DOPA%')
    expect(BASE_DOPA_PERCENT_NOTE).toContain('ボーナス')
  })
})
