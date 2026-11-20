import { describe, expect, it } from 'vitest'
import { getSubScreenBackTarget, resolveSubScreenOrigin } from './subScreenNavigation'

describe('resolveSubScreenOrigin (次フェーズ: Profile-aware戻るナビゲーション)', () => {
  it('現在画面がprofileのときだけoriginはprofile', () => {
    expect(resolveSubScreenOrigin('profile')).toBe('profile')
  })

  it('title・それ以外の画面からの場合はoriginはtitle（Homeへ戻す）', () => {
    expect(resolveSubScreenOrigin('title')).toBe('title')
    expect(resolveSubScreenOrigin('endlessResult')).toBe('title')
    expect(resolveSubScreenOrigin('battleHome')).toBe('title')
  })
})

describe('getSubScreenBackTarget', () => {
  it('origin=profileならscreen=profile・label=プロフィール', () => {
    expect(getSubScreenBackTarget('profile')).toEqual({ screen: 'profile', label: 'プロフィール' })
  })

  it('origin=titleならscreen=title・label=ホーム', () => {
    expect(getSubScreenBackTarget('title')).toEqual({ screen: 'title', label: 'ホーム' })
  })
})
