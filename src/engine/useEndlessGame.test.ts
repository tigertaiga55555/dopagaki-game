import { describe, expect, it } from 'vitest'
import { shouldShowEndlessTimerBar } from './useEndlessGame'

/**
 * Ver.6 Phase 4.3（実機QA修正）: Endless共通の視覚タイマーバーは、問題マウント直後から
 * 一定速度で減る前提（normal/初級）のときだけ表示してよい。final（中級/上級のFINAL DOPA
 * TRIAL由来、記憶問題のように内部で独自の時間進行を持つ）・challenge500（上級の
 * Challenge500由来、外付けタイマー管理）では、それぞれの本家画面と同じく表示しない。
 *
 * useEndlessGame自体はReact hookのため直接レンダーテストはしない（本プロジェクトの
 * 既存方針どおりDOM/コンポーネントテストは行わない）が、shouldShowEndlessTimerBarは
 * DOM・Reactに一切依存しない純粋関数としてexportしてあるため、ここで直接検証できる。
 */
describe('shouldShowEndlessTimerBar (Ver.6 Phase 4.3: Endlessタイマーバー表示ルール)', () => {
  it('shows the bar for normal (初級=0〜120%相当)', () => {
    expect(shouldShowEndlessTimerBar('normal')).toBe(true)
  })

  it('hides the bar for final (中級/上級のFINAL DOPA TRIAL由来、本家も視覚バーなし)', () => {
    expect(shouldShowEndlessTimerBar('final')).toBe(false)
  })

  it('hides the bar for challenge500 (上級のChallenge500由来、本家も視覚バーなし)', () => {
    expect(shouldShowEndlessTimerBar('challenge500')).toBe(false)
  })
})
