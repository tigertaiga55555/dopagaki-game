import { beforeEach, describe, expect, it } from 'vitest'
import { HEART_CAP, HEART_REGEN_MS, localHeartRepository, qaSetHeartCount } from './heartRepository'

function installFakeLocalStorage(): void {
  const store = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size
    },
  } as Storage
}

const MIN = 60 * 1000
const T0 = 1_700_000_000_000

describe('heartRepository (次フェーズ: DOPA HEART本実装)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('初期値は5（新規ユーザー・既存ユーザーいずれも保存状態が無ければ5から開始、item 18）', () => {
    expect(localHeartRepository.getHeartCount(T0)).toBe(5)
  })

  it('5のとき20分経過しても5のまま（上限に達している間は自然回復しない）', () => {
    qaSetHeartCount(5, T0)
    expect(localHeartRepository.getHeartCount(T0 + HEART_REGEN_MS)).toBe(5)
  })

  it('4で19分59秒では4のまま（1 tickぶんに1秒足りない）', () => {
    qaSetHeartCount(4, T0)
    expect(localHeartRepository.getHeartCount(T0 + HEART_REGEN_MS - 1000)).toBe(4)
  })

  it('4で20分経過すると5になる', () => {
    qaSetHeartCount(4, T0)
    expect(localHeartRepository.getHeartCount(T0 + HEART_REGEN_MS)).toBe(5)
  })

  it('3で40分経過すると5になる（2 tick分、3+2=5で上限ちょうど）', () => {
    qaSetHeartCount(3, T0)
    expect(localHeartRepository.getHeartCount(T0 + 2 * HEART_REGEN_MS)).toBe(5)
  })

  it('0で20分経過すると1になる', () => {
    qaSetHeartCount(0, T0)
    expect(localHeartRepository.getHeartCount(T0 + HEART_REGEN_MS)).toBe(1)
  })

  it('0で100分経過すると5になる（5 tick分でちょうど上限、それ以上は増えない）', () => {
    qaSetHeartCount(0, T0)
    expect(localHeartRepository.getHeartCount(T0 + 5 * HEART_REGEN_MS)).toBe(5)
    // 上限超過分のtickは捨てられる（6 tick分経過させても6にはならない）。
    qaSetHeartCount(0, T0)
    expect(localHeartRepository.getHeartCount(T0 + 6 * HEART_REGEN_MS)).toBe(5)
  })

  it('8（QA/将来の購入等で上限を超えて持てる値）は時間が経過しても8のまま（上限以上は常に一時停止）', () => {
    qaSetHeartCount(8, T0)
    expect(localHeartRepository.getHeartCount(T0 + 10 * HEART_REGEN_MS)).toBe(8)
  })

  it('8から3回消費して5になった後は、時間が経過しても自然回復しない（まだ上限以上）', () => {
    qaSetHeartCount(8, T0)
    localHeartRepository.consumeHeart(T0)
    localHeartRepository.consumeHeart(T0)
    const third = localHeartRepository.consumeHeart(T0)
    expect(third.remaining).toBe(5)
    expect(localHeartRepository.getHeartCount(T0 + HEART_REGEN_MS)).toBe(5)
  })

  it('5から消費して4になった直後に20分経過すると5に戻る（上限→下限を跨いだ消費の瞬間に基準時刻がリセットされる）', () => {
    qaSetHeartCount(5, T0)
    const result = localHeartRepository.consumeHeart(T0)
    expect(result).toEqual({ ok: true, remaining: 4 })
    expect(localHeartRepository.getHeartCount(T0 + HEART_REGEN_MS)).toBe(5)
  })

  it('0のときconsumeHeartはok:falseを返し、所持数を一切変化させない', () => {
    qaSetHeartCount(0, T0)
    const result = localHeartRepository.consumeHeart(T0)
    expect(result).toEqual({ ok: false, remaining: 0 })
    expect(localHeartRepository.getHeartCount(T0)).toBe(0)
  })

  it('consumeHeart: bypass=trueなら所持数を一切変化させずok:trueを返す（将来のDOPA PASS等の無制限entitlement用の境界）', () => {
    qaSetHeartCount(0, T0)
    const result = localHeartRepository.consumeHeart(T0, true)
    expect(result).toEqual({ ok: true, remaining: 0 })
    expect(localHeartRepository.getHeartCount(T0)).toBe(0)
  })

  it('getNextRecoveryEtaMs: 上限以上ならnull、それ未満なら次の回復までの残りミリ秒', () => {
    qaSetHeartCount(5, T0)
    expect(localHeartRepository.getNextRecoveryEtaMs(T0)).toBeNull()

    qaSetHeartCount(3, T0)
    expect(localHeartRepository.getNextRecoveryEtaMs(T0)).toBe(HEART_REGEN_MS)
    expect(localHeartRepository.getNextRecoveryEtaMs(T0 + 5 * MIN)).toBe(HEART_REGEN_MS - 5 * MIN)
  })

  it('HEART_CAPは5（テストの前提と実装定数が食い違っていないことの保険）', () => {
    expect(HEART_CAP).toBe(5)
  })
})
