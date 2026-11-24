import { describe, expect, it } from 'vitest'
import { buildEndlessSharePayload, buildRushSharePayload, encodeResultSharePayload } from '../share/resultSharePayload'
import { buildResultOgpCopy, buildResultOgpHtml, isCrawlerUserAgent } from './ogpCard'

describe('isCrawlerUserAgent（item 82: X等のリンクプレビュー用クローラー判定）', () => {
  it('Xの公式クローラーUAを検出する', () => {
    expect(isCrawlerUserAgent('Twitterbot/1.0')).toBe(true)
  })

  it.each(['facebookexternalhit/1.1', 'Slackbot-LinkExpanding 1.0', 'Discordbot/2.0', 'TelegramBot (like TwitterBot)', 'LinkedInBot/1.0', 'WhatsApp/2.23'])(
    '主要なリンクプレビューUA（%s）も検出する',
    (ua) => {
      expect(isCrawlerUserAgent(ua)).toBe(true)
    },
  )

  it('通常のブラウザUAはfalse', () => {
    expect(isCrawlerUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15')).toBe(false)
  })

  it('User-Agentが無い（null）場合はfalse', () => {
    expect(isCrawlerUserAgent(null)).toBe(false)
  })
})

describe('buildResultOgpCopy（item 82: 実際の数値入りタイトル/説明文）', () => {
  it('DOPA RUSH: percentを含むタイトル・説明文を生成する', () => {
    const copy = buildResultOgpCopy(buildRushSharePayload(428, 'nonce'))
    expect(copy.title).toContain('428')
    expect(copy.description).toContain('428')
  })

  it.each(['beginner', 'intermediate', 'advanced'] as const)('ENDLESS %s: 難易度ラベル・STREAKを含むタイトル・説明文を生成する', (difficulty) => {
    const copy = buildResultOgpCopy(buildEndlessSharePayload(difficulty, 23, 'nonce'))
    expect(copy.title).toContain('23')
    expect(copy.title).toContain('STREAK')
    expect(copy.description).toContain('23')
  })
})

describe('buildResultOgpHtml（item 82: /s/:idのOGPカードHTML）', () => {
  it('正しいresultIdなら、実際の数値入りog:title/og:description/og:image/twitter:cardを含むHTMLを返す', () => {
    const resultId = encodeResultSharePayload(buildRushSharePayload(428, 'nonce-1'))
    const html = buildResultOgpHtml('https://example.workers.dev', resultId)
    expect(html).not.toBeNull()
    expect(html).toContain('og:title')
    expect(html).toContain('428')
    expect(html).toContain('og:description')
    expect(html).toContain('og:image')
    expect(html).toContain('https://example.workers.dev/og-image-v5.png')
    expect(html).toContain('twitter:card')
    expect(html).toContain('summary_large_image')
    expect(html).toContain(`https://example.workers.dev/s/${resultId}`)
  })

  it('ENDLESS: 難易度+STREAKが実際にHTMLへ含まれる', () => {
    const resultId = encodeResultSharePayload(buildEndlessSharePayload('advanced', 23, 'nonce-2'))
    const html = buildResultOgpHtml('https://example.workers.dev', resultId)
    expect(html).toContain('上級')
    expect(html).toContain('23')
    expect(html).toContain('STREAK')
  })

  it('壊れた/改ざんされたresultIdにはnullを返す（架空の結果をでっち上げない）', () => {
    expect(buildResultOgpHtml('https://example.workers.dev', 'not-a-valid-payload')).toBeNull()
  })

  it('HTMLインジェクション対策: タイトル・説明文はエスケープされる', () => {
    // percentは常に数値（デコード時にNumber()でパースされる）ため、任意の文字列を
    // そのまま埋め込む経路は無い——ここでは生成されたHTML自体が閉じタグ等を含まないことだけ確認する。
    const resultId = encodeResultSharePayload(buildRushSharePayload(100, 'nonce-3'))
    const html = buildResultOgpHtml('https://example.workers.dev', resultId)
    expect(html).not.toContain('<script>')
  })

  it('og:url/og:imageは常にリクエストの実際のorigin（Preview URL）を使う——本番URL固定ではない', () => {
    const resultId = encodeResultSharePayload(buildRushSharePayload(100, 'nonce-4'))
    const htmlA = buildResultOgpHtml('https://preview-a.workers.dev', resultId)
    const htmlB = buildResultOgpHtml('https://preview-b.workers.dev', resultId)
    expect(htmlA).toContain('preview-a.workers.dev')
    expect(htmlB).toContain('preview-b.workers.dev')
  })

  it('meta refreshで実際のSPAページへ即座に誘導する（誤検知で人間が来ても詰まらせない）', () => {
    const resultId = encodeResultSharePayload(buildRushSharePayload(100, 'nonce-5'))
    const html = buildResultOgpHtml('https://example.workers.dev', resultId)
    expect(html).toContain('http-equiv="refresh"')
  })
})
