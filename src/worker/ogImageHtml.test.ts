import { describe, expect, it } from 'vitest'
import { buildChallengeImageHtml, buildEndlessResultImageHtml, buildResultImageHtml, buildRushResultImageHtml } from './ogImageHtml'
import { buildEndlessSharePayload, buildRushSharePayload } from '../share/resultSharePayload'

/**
 * 次フェーズ（item 90-92、item 93）: ogImageHtml.tsは純粋関数のみ（workers-ogを一切
 * importしない）なので、Node環境のvitestから直接importして「実際に正しいテキストが
 * HTML文字列へ入っているか」だけを検証できる——実際のPNG化（ogImageRenderer.ts）は
 * wrangler dev実機でのみ検証する（ToDo: 最終報告に記載）。
 */
describe('buildRushResultImageHtml（item 90: DOPA RUSH動的結果画像）', () => {
  it('49%を渡すと、実際に"49%"を含むHTMLを返す', () => {
    const html = buildRushResultImageHtml(49)
    expect(html).toContain('49%')
    expect(html).toContain('DOPA RUSH')
  })

  it('display:flexを持つ（satoriの制約を満たす最低限の確認）', () => {
    const html = buildRushResultImageHtml(100)
    expect(html).toContain('display:flex')
  })

  it.each([
    [10, '理性残存型ドパガキ'],
    [92, '野生型ドパガキ'],
    [300, '伝説のドパガキ'],
  ])('item 104-108, 111: DOPA%のすぐ下にDOPA TYPE名（percent=%i→%s）を含む', (percent, typeName) => {
    const html = buildRushResultImageHtml(percent)
    expect(html).toContain(typeName)
  })
})

describe('buildEndlessResultImageHtml（item 91: ENDLESS動的結果画像）', () => {
  it('初級・16連続を渡すと、"初級"と"16"と"STREAK"を含むHTMLを返す', () => {
    const html = buildEndlessResultImageHtml('beginner', 16)
    expect(html).toContain('初級')
    expect(html).toContain('16')
    expect(html).toContain('STREAK')
  })

  it.each(['beginner', 'intermediate', 'advanced'] as const)('%sの場合、正しい難易度ラベルを含む', (difficulty) => {
    const label: Record<typeof difficulty, string> = { beginner: '初級', intermediate: '中級', advanced: '上級' } as never
    const html = buildEndlessResultImageHtml(difficulty, 1)
    expect(html).toContain(label[difficulty])
  })

  it('DOPA RUSHの画像とは異なるアクセント色（難易度別colorRgb）を使う——視覚的に区別できる', () => {
    const beginner = buildEndlessResultImageHtml('beginner', 10)
    const advanced = buildEndlessResultImageHtml('advanced', 10)
    expect(beginner).not.toBe(advanced)
    expect(beginner).toContain('rgb(74, 222, 128)')
    expect(advanced).toContain('rgb(248, 113, 113)')
  })
})

describe('buildResultImageHtml（item 90-91: payloadからモードに応じて正しい画像を組み立てる）', () => {
  it('rush modeのpayloadならRUSH画像になる', () => {
    const html = buildResultImageHtml(buildRushSharePayload(77, 'n1'))
    expect(html).toContain('77%')
    expect(html).toContain('DOPA RUSH')
  })

  it('endless modeのpayloadならENDLESS画像になる（難易度・STREAKが実resultから反映される）', () => {
    const html = buildResultImageHtml(buildEndlessSharePayload('advanced', 23, 'n2'))
    expect(html).toContain('上級')
    expect(html).toContain('23')
    expect(html).toContain('STREAK')
  })
})

describe('buildChallengeImageHtml（item 92: 挑戦状専用の画像、通常結果画像とは視覚的に区別する）', () => {
  it('DOPA RUSH系（mode!==endless）: ニックネーム・「挑戦状」・creatorScore%に挑戦、を含む', () => {
    const html = buildChallengeImageHtml('ドパ太郎', 'normal', 95)
    expect(html).toContain('挑戦状')
    expect(html).toContain('ドパ太郎')
    expect(html).toContain('95%')
    expect(html).toContain('95%に挑戦')
  })

  it('ENDLESS: 難易度+STREAK+「挑戦」を含む', () => {
    const html = buildChallengeImageHtml('ドパ太郎', 'endless', 37, 'intermediate')
    expect(html).toContain('挑戦状')
    expect(html).toContain('中級')
    expect(html).toContain('37')
    expect(html).toContain('STREAK')
  })

  it('通常結果画像（RUSH/ENDLESS）とは異なる配色（赤系の挑戦状フレーミング）を使う', () => {
    const challengeHtml = buildChallengeImageHtml('ドパ太郎', 'normal', 50)
    const rushHtml = buildRushResultImageHtml(50)
    expect(challengeHtml).toContain('#ef4444')
    expect(rushHtml).not.toContain('#ef4444')
  })

  it('HTMLインジェクション対策: ニックネームはエスケープされる', () => {
    const html = buildChallengeImageHtml('<script>alert(1)</script>', 'normal', 10)
    expect(html).not.toContain('<script>')
  })

  /**
   * 次フェーズ（item 133-135、追加最終調整ラウンド）: Xでのレイアウトズレ修正の回帰テスト。
   * ENDLESSモードのstatLineで「巨大な数字とSTREAKラベルをalign-items:baselineで横並び」
   * にしていた構成（間隔が不自然に見える原因だったsatoriの制約）を廃止し、
   * buildEndlessResultImageHtmlと同じ縦積み構成へ統一したことを確認する。
   */
  it('item 133-135: ENDLESSモードのstatLineはbaseline横並びを使わず、縦積み構成になっている', () => {
    const html = buildChallengeImageHtml('ドパ太郎', 'endless', 37, 'intermediate')
    expect(html).not.toContain('align-items:baseline')
    expect(html).toContain('37')
    expect(html).toContain('STREAK')
  })

  it('item 133-135: 1200x630の原画像に対し、上下左右に十分なsafe marginを確保している（上40px・左右68px・下48px、重要テキストが端ギリギリにならない）', () => {
    const html = buildChallengeImageHtml('ドパ太郎', 'normal', 50)
    expect(html).toContain('padding:40px 68px 48px')
  })

  it('item 133-135: 配色（赤/オレンジ系）・バッジ・文言は変更していない', () => {
    const html = buildChallengeImageHtml('ドパ太郎', 'normal', 50)
    expect(html).toContain('#ef4444')
    expect(html).toContain('#f59e0b')
    expect(html).toContain('挑戦状')
    expect(html).toContain('50%に挑戦')
    expect(html).toContain('ドパガキゲーム')
  })
})
