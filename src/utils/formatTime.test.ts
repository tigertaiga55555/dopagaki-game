import { describe, expect, it } from 'vitest'
import { formatMmSs } from './formatTime'

describe('formatMmSs', () => {
  it('ミリ秒をmm:ss形式へ変換する（切り上げ）', () => {
    expect(formatMmSs(20 * 60 * 1000)).toBe('20:00')
    expect(formatMmSs(0)).toBe('00:00')
    expect(formatMmSs(1000)).toBe('00:01')
    expect(formatMmSs(61_000)).toBe('01:01')
  })

  it('負の値は0として扱う', () => {
    expect(formatMmSs(-500)).toBe('00:00')
  })

  it('1000ms未満の余りは1秒へ切り上げる', () => {
    expect(formatMmSs(500)).toBe('00:01')
  })
})
