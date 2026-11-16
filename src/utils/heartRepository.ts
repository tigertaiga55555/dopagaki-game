/**
 * 次フェーズ（DOPA HEART本実装）: DOPA RUSH/ENDLESSの開始に必要なHeart（挑戦回数）を
 * 管理する。utils/playerStatsRepository.ts・challenge/remoteChallengeDataSource.tsと同じ
 * 「Repositoryインターフェース＋ローカル実装」方針を踏襲し、UI/呼び出し元は
 * `HeartRepository`型だけに依存させる——将来、アカウント連携でWeb/iPhone共通の
 * server-backed実装（Worker API経由）へ丸ごと差し替える際、このファイルの実装だけを
 * 置き換えれば済み、画面側のコードは一切変更不要にするための設計。
 *
 * 自然回復モデル（item 8/16）: 所持Heartが上限（HEART_CAP=5）未満の間だけ、
 * HEART_REGEN_MSごとに1回復する。`lastUpdateAt`は「直近に回復計算を適用した基準時刻」
 * （上限に達している間は更新しない＝一時停止）。消費によって上限未満へ下がった瞬間
 * だけ`lastUpdateAt`を消費時刻へリセットする（上限に達していた間に経過していた
 * 任意の長さの時間を、復帰後に即座に清算してしまわないようにするため）。
 *
 * データモデル上、所持数は5をhard capにしない（将来のrewarded ad/購入/DOPA PASSで
 * 上限を超えて持てる設計を残す、というユーザー指示）。自然回復だけが「5未満なら
 * 回復・5以上なら停止」という形でHEART_CAPを参照する。
 *
 * Payment entitlementとは完全に分離する（このファイルは購入状態・広告視聴回数等を
 * 一切知らない）。consumeHeart()の`bypass`引数は、将来DOPA PASS等の「無制限」
 * entitlementを持つユーザーがここを素通りできるようにするための境界だけを先に
 * 用意したもの（今回のラウンドでは常にfalseを渡す呼び出し元しか存在せず、架空のPASS
 * 状態をUIには一切出さない）。
 */

export const HEART_CAP = 5
export const HEART_REGEN_MS = 20 * 60 * 1000
const HEART_INITIAL_COUNT = 5

const HEART_STATE_KEY = 'dopagaki:heartStateV1'

interface StoredHeartState {
  count: number
  lastUpdateAt: number
}

function readStoredState(): StoredHeartState | null {
  try {
    const raw = localStorage.getItem(HEART_STATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredHeartState>
    if (typeof parsed.count !== 'number' || typeof parsed.lastUpdateAt !== 'number') return null
    return { count: parsed.count, lastUpdateAt: parsed.lastUpdateAt }
  } catch {
    return null
  }
}

function writeStoredState(state: StoredHeartState): void {
  try {
    localStorage.setItem(HEART_STATE_KEY, JSON.stringify(state))
  } catch {
    // 書き込みに失敗しても次回アクセス時に再試行されるだけで、致命的ではない。
  }
}

/**
 * 保存されている状態が無ければ、既存ユーザー・新規ユーザーの区別なく初期値（5個、
 * 基準時刻=今）を作る（item 18: Heartデータを持たないユーザーは初回アクセス時に
 * 5 Heartから開始する。既存のProfile/Achievement/record等は一切読み書きしないため、
 * それらを壊す余地がない）。
 */
function loadOrInitState(now: number): StoredHeartState {
  const existing = readStoredState()
  if (existing) return existing
  const initial: StoredHeartState = { count: HEART_INITIAL_COUNT, lastUpdateAt: now }
  writeStoredState(initial)
  return initial
}

/**
 * 自然回復の清算。所持数がHEART_CAP以上なら何もしない（一時停止中）。HEART_CAP未満の
 * 間だけ、経過時間からHEART_REGEN_MSごとに1回復させ、消費しきれなかった余り時間は
 * `lastUpdateAt`を`ticks * HEART_REGEN_MS`ぶんだけ進めることで保持する（次回アクセス時に
 * 続きから数えられるようにするため、`now`へ丸めて進めない）。
 */
function settle(state: StoredHeartState, now: number): StoredHeartState {
  if (state.count >= HEART_CAP) return state
  const elapsed = now - state.lastUpdateAt
  if (elapsed <= 0) return state
  const ticks = Math.floor(elapsed / HEART_REGEN_MS)
  if (ticks <= 0) return state
  return { count: Math.min(HEART_CAP, state.count + ticks), lastUpdateAt: state.lastUpdateAt + ticks * HEART_REGEN_MS }
}

export interface HeartRepository {
  /** 自然回復を清算した上での、現在の所持Heart数（5を超えて持てる設計のため上限なし）。 */
  getHeartCount(now?: number): number
  /** 次の1回復までの残りミリ秒。既に上限以上（回復が一時停止中）ならnull。 */
  getNextRecoveryEtaMs(now?: number): number | null
  /**
   * countdown開始時にだけ呼ぶ、1個消費する操作。所持0なら何もせず{ok:false}を返す
   * （呼び出し側は事前にgetHeartCountで0かどうかを見て開始自体をブロックする想定だが、
   * ここでも二重に安全側へ倒す）。`bypass`は将来のDOPA PASS等の無制限entitlement用の
   * 境界（今回は常にfalse固定の呼び出し元のみ）。
   */
  consumeHeart(now?: number, bypass?: boolean): { ok: boolean; remaining: number }
}

export const localHeartRepository: HeartRepository = {
  getHeartCount(now = Date.now()): number {
    const settled = settle(loadOrInitState(now), now)
    writeStoredState(settled)
    return settled.count
  },

  getNextRecoveryEtaMs(now = Date.now()): number | null {
    const settled = settle(loadOrInitState(now), now)
    writeStoredState(settled)
    if (settled.count >= HEART_CAP) return null
    const elapsedSinceAnchor = now - settled.lastUpdateAt
    return Math.max(0, HEART_REGEN_MS - elapsedSinceAnchor)
  },

  consumeHeart(now = Date.now(), bypass = false): { ok: boolean; remaining: number } {
    const settled = settle(loadOrInitState(now), now)
    if (bypass) return { ok: true, remaining: settled.count }
    if (settled.count <= 0) {
      writeStoredState(settled)
      return { ok: false, remaining: settled.count }
    }
    const wasAtOrAboveCap = settled.count >= HEART_CAP
    const nextCount = settled.count - 1
    const nextLastUpdateAt = wasAtOrAboveCap && nextCount < HEART_CAP ? now : settled.lastUpdateAt
    const next: StoredHeartState = { count: nextCount, lastUpdateAt: nextLastUpdateAt }
    writeStoredState(next)
    return { ok: true, remaining: nextCount }
  },
}

/**
 * Preview/QA専用（item 15）: Heart所持数を直接セットする。Production UIからは絶対に
 * 呼ばない（呼び出し元はsrc/dev/配下のQA専用画面・E2Eテストのみに限定する）。
 */
export function qaSetHeartCount(count: number, now = Date.now()): void {
  writeStoredState({ count, lastUpdateAt: now })
}
