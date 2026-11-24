import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildXShareText, shareResultViaWebShare } from './shareResult'

/**
 * 次フェーズ（ゲーム機能クローズラウンド、item 97-99）: 「結果を共有」
 * （shareResultViaWebShare）のユニットテスト。navigator.share自体はjsdom環境に無いため、
 * テストごとにグローバルnavigatorをモックして差し替える。
 */
describe('shareResultViaWebShare（item 97-99: OSの共有シートへ結果テキスト＋/s/:id URLを渡す）', () => {
  const originalNavigator = globalThis.navigator

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', { value: originalNavigator, configurable: true })
    vi.restoreAllMocks()
  })

  it('navigator.shareがある環境: text＋urlを渡して呼び出し、"shared"を返す', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(globalThis, 'navigator', { value: { share }, configurable: true })

    const outcome = await shareResultViaWebShare({ mode: 'rush', percent: 49, resultId: 'rid-1', shareUrl: 'https://example.com/s/rid-1' })

    expect(outcome).toBe('shared')
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://example.com/s/rid-1', text: expect.stringContaining('49') }))
  })

  it('ENDLESSのpayloadでも正しいmode別テキストで呼び出す', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(globalThis, 'navigator', { value: { share }, configurable: true })

    await shareResultViaWebShare({ mode: 'endless', difficulty: 'advanced', streak: 23, resultId: 'rid-2', shareUrl: 'https://example.com/s/rid-2' })

    expect(share).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('23') }))
  })

  it('ユーザーが共有シートを自分でキャンセルした場合（AbortError）は"cancelled"を返す（トースト非表示の判断に使う）', async () => {
    const abortError = Object.assign(new Error('cancelled'), { name: 'AbortError' })
    const share = vi.fn().mockRejectedValue(abortError)
    Object.defineProperty(globalThis, 'navigator', { value: { share }, configurable: true })

    const outcome = await shareResultViaWebShare({ mode: 'rush', percent: 10, resultId: 'rid-3', shareUrl: 'https://example.com/s/rid-3' })

    expect(outcome).toBe('cancelled')
  })

  it('navigator.shareが無い環境: クリップボードへコピーして"copied"を返す（詰まらせない）', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText } }, configurable: true })

    const outcome = await shareResultViaWebShare({ mode: 'rush', percent: 10, resultId: 'rid-4', shareUrl: 'https://example.com/s/rid-4' })

    expect(outcome).toBe('copied')
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('https://example.com/s/rid-4'))
  })

  it('navigator.share・clipboardのどちらも無い/失敗する環境では"failed"を返す', async () => {
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true })

    const outcome = await shareResultViaWebShare({ mode: 'rush', percent: 10, resultId: 'rid-5', shareUrl: 'https://example.com/s/rid-5' })

    expect(outcome).toBe('failed')
  })
})

describe('buildXShareText（item 107, 110: DOPA TYPE名を必ず含める／「お前」表現を削除）', () => {
  it('DOPA RUSH: DOPA TYPE名（80-99%帯=野生型ドパガキ）を含み、「お前」は含まない', () => {
    const text = buildXShareText({ mode: 'rush', percent: 92, resultId: 'rid', shareUrl: 'https://example.com/s/rid' })
    expect(text).toContain('92％')
    expect(text).toContain('野生型ドパガキ')
    expect(text).not.toContain('お前')
    expect(text).toContain('あなたは')
  })

  it.each([
    [10, '理性残存型ドパガキ'],
    [300, '伝説のドパガキ'],
    [500, 'ドパガキの神'],
  ])('percent=%i → %sを含む', (percent, typeName) => {
    const text = buildXShareText({ mode: 'rush', percent, resultId: 'rid', shareUrl: 'https://example.com/s/rid' })
    expect(text).toContain(typeName)
  })

  it('ENDLESS: 「お前」を含まない（DOPA TYPEは追加しない、item 114で現状維持）', () => {
    const text = buildXShareText({ mode: 'endless', difficulty: 'beginner', streak: 5, resultId: 'rid', shareUrl: 'https://example.com/s/rid' })
    expect(text).not.toContain('お前')
    expect(text).not.toContain('型ドパガキ')
  })
})
