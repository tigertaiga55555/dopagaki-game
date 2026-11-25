import { afterEach, describe, expect, it, vi } from 'vitest'
import { trackChallengeCreated, trackChallengeOpened, trackChallengePlayed, trackChallengeWin } from './analytics'

/**
 * Ver.6 Phase 5.2（Challenge機能完成）: このプロジェクトのvitestはdefault（node環境、
 * DOM無し）のため、windowはテスト側で用意しない限り存在しない。trackEvent自体は
 * 「window.gtagが関数として存在する場合だけ呼ぶ、存在しなければ静かに何もしない」
 * 安全な実装（analytics.ts参照）であるため、ここではその両方の状態
 * （gtagがある場合／window自体が無い場合＝Preview/QA等でGA4が読み込まれていない
 * 環境に相当）で例外を投げず、ある場合だけ正しいevent名・paramsで呼ぶことを検証する。
 */
describe('Challenge analytics events (Ver.6 Phase 5.2)', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window
  })

  it('window.gtagが無い環境（未読み込み・ブロック等）でも例外を投げない', () => {
    expect(() => trackChallengeCreated('normal')).not.toThrow()
    expect(() => trackChallengeOpened('finalTrial')).not.toThrow()
    expect(() => trackChallengePlayed('challenge500')).not.toThrow()
    expect(() => trackChallengeWin('normal')).not.toThrow()
  })

  it('window.gtagがある場合、modeだけをパラメータとして正しいevent名で送信する（challengeId等の識別情報は含めない）', () => {
    const gtag = vi.fn()
    ;(globalThis as unknown as { window: { gtag: typeof gtag } }).window = { gtag }

    trackChallengeCreated('challenge500')
    trackChallengeOpened('finalTrial')
    trackChallengePlayed('normal')
    trackChallengeWin('challenge500')

    expect(gtag).toHaveBeenCalledWith('event', 'challenge_created', { mode: 'challenge500' })
    expect(gtag).toHaveBeenCalledWith('event', 'challenge_opened', { mode: 'finalTrial' })
    expect(gtag).toHaveBeenCalledWith('event', 'challenge_played', { mode: 'normal' })
    expect(gtag).toHaveBeenCalledWith('event', 'challenge_win', { mode: 'challenge500' })
    expect(gtag).toHaveBeenCalledTimes(4)
  })
})
