import { describe, expect, it } from 'vitest'
import { AD_RESULT_SCREEN, AD_START_SCREEN, ADS_ENABLED_V6 } from './ads'

/**
 * Ver.6 Phase 9（実機QA反映）: 広告を「削除」ではなく「一時非表示」にしたことの検証。
 * ADS_ENABLED_V6がfalseであること（TitleScreen/ResultScreenがAdSlotを描画しない）と、
 * 広告インフラ自体（タグ・サイズ・ID）が1文字も壊れずに残っていることの両方を確認する。
 */
describe('ads config (Ver.6 Phase 9: 広告インフラ保持＋現状非表示)', () => {
  it('ADS_ENABLED_V6はfalse（Ver.6 Previewの現行UIには描画しない）', () => {
    expect(ADS_ENABLED_V6).toBe(false)
  })

  it('AD_START_SCREEN（ホーム画面下部広告）の設定は破壊されず残っている', () => {
    expect(AD_START_SCREEN).toEqual({
      slotName: 'ドパガキ_スタート_320x100',
      width: 320,
      height: 100,
      tag: '<!-- admax -->\n<script src="https://adm.shinobi.jp/s/940610503db258a80154a2daac7a4783"></script>\n<!-- admax -->',
    })
  })

  it('AD_RESULT_SCREEN（通常結果画面広告）の設定は破壊されず残っている', () => {
    expect(AD_RESULT_SCREEN).toEqual({
      slotName: 'ドパガキ_結果_300x250',
      width: 300,
      height: 250,
      tag: '<!-- admax -->\n<script src="https://adm.shinobi.jp/s/283af580a4b2ce82cfafca93c86239f5"></script>\n<!-- admax -->',
    })
  })
})
