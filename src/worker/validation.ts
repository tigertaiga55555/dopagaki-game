import { PRESET_ICONS } from '../config/profileConfig'
import { TITLE_DEFS } from '../config/titles'
import type {
  ChallengeConditions,
  ChallengeMode,
  ChallengeProblemSet,
  ChallengeProblemSetItem,
  CreateChallengeAttemptInput,
  CreateChallengeInput,
} from '../challenge/types'
import type { AvatarRef } from '../types'

const KNOWN_TITLE_IDS = new Set(TITLE_DEFS.map((t) => t.id))

/**
 * Ver.6 Phase 5.1（Challengeバックエンド基盤）: 「任意のクライアント入力をそのまま信用しない」
 * というユーザー指示に基づき、Worker（src/worker/index.ts）がD1へ書き込む前に必ず通す
 * 検証ロジック。DOM・Workersランタイムに依存しない純粋関数のみで構成するため、vitestで
 * モックなしに直接テストできる。
 *
 * 1項目でも不正ならinvalid（理由付き）を返す——部分的に信用して一部だけ補正する、
 * という曖昧な扱いは一切しない。
 */
const MAX_NICKNAME_LENGTH = 40
const MAX_PLAYER_ID_LENGTH = 128
// Ver.6 Phase 5.2: 通常モード（0〜120%）は60秒間で理論上200問を超えうるため、
// Phase 5.1時点の200/32000から引き上げた（それでも無制限ではない、明確な上限）。
const MAX_PROBLEM_SET_ITEMS = 300
const MAX_PROBLEM_SET_JSON_BYTES = 60_000
const MAX_QUESTION_TYPE_LENGTH = 80
const MAX_TAG_LENGTH = 40
const MAX_SCORE = 100_000

const CHALLENGE_MODES: ChallengeMode[] = ['normal', 'finalTrial', 'challenge500']

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength
}

function isFiniteNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function validateAvatar(value: unknown): value is AvatarRef {
  if (typeof value !== 'object' || value === null) return false
  const avatar = value as Partial<AvatarRef>
  if (avatar.kind === 'preset') {
    return typeof avatar.iconId === 'string' && (PRESET_ICONS as string[]).includes(avatar.iconId)
  }
  if (avatar.kind === 'remoteCustom') {
    // Ver.6 Phase 5.1時点ではまだどの画面からも生成されない（将来のサーバー画像用の型だけ先に許容する）。
    return typeof avatar.url === 'string' && avatar.url.length > 0 && avatar.url.length <= 2000
  }
  return false
}

function validateProblemSetItem(value: unknown): value is ChallengeProblemSetItem {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Partial<ChallengeProblemSetItem>
  if (!isNonEmptyString(item.type, MAX_QUESTION_TYPE_LENGTH)) return false
  if (item.targetTimeMs !== undefined && !isFiniteNumberInRange(item.targetTimeMs, 0, 60_000)) return false
  if (item.tags !== undefined) {
    if (!Array.isArray(item.tags) || item.tags.length > 20) return false
    if (!item.tags.every((t) => typeof t === 'string' && t.length <= MAX_TAG_LENGTH)) return false
  }
  if (typeof item.data !== 'object' || item.data === null || Array.isArray(item.data)) return false
  return true
}

function validateProblemSet(value: unknown): value is ChallengeProblemSet {
  if (typeof value !== 'object' || value === null) return false
  const set = value as Partial<ChallengeProblemSet>
  if (set.version !== 1) return false
  if (!Array.isArray(set.items) || set.items.length === 0 || set.items.length > MAX_PROBLEM_SET_ITEMS) return false
  if (!set.items.every(validateProblemSetItem)) return false
  // シリアライズ後のサイズも必ず検証する（1項目ずつは妥当でも、件数×サイズで肥大化するD1行を防ぐ）。
  if (JSON.stringify(set).length > MAX_PROBLEM_SET_JSON_BYTES) return false
  return true
}

function validateConditions(value: unknown, mode: ChallengeMode): value is ChallengeConditions {
  if (typeof value !== 'object' || value === null) return false
  const conditions = value as Partial<ChallengeConditions>
  return conditions.mode === mode
}

/** null（未装備）、または実在するTitleDef.idのいずれかだけを許可する（任意の文字列を信用しない）。 */
function isValidEquippedTitle(value: unknown): value is string | null {
  if (value === null) return true
  return typeof value === 'string' && KNOWN_TITLE_IDS.has(value)
}

export interface ValidationResult {
  ok: boolean
  value?: CreateChallengeInput
  message?: string
}

export function validateCreateChallengeInput(raw: unknown): ValidationResult {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, message: 'request body must be a JSON object' }
  }
  const input = raw as Partial<CreateChallengeInput>

  if (!isNonEmptyString(input.creatorPlayerId, MAX_PLAYER_ID_LENGTH)) {
    return { ok: false, message: 'creatorPlayerId is required' }
  }
  if (!isNonEmptyString(input.creatorNickname, MAX_NICKNAME_LENGTH)) {
    return { ok: false, message: 'creatorNickname is required' }
  }
  if (!validateAvatar(input.creatorIcon)) {
    return { ok: false, message: 'creatorIcon is invalid' }
  }
  if (!isValidEquippedTitle(input.creatorEquippedTitle)) {
    return { ok: false, message: 'creatorEquippedTitle must be a known title id or null' }
  }
  if (typeof input.mode !== 'string' || !CHALLENGE_MODES.includes(input.mode as ChallengeMode)) {
    return { ok: false, message: 'mode is invalid' }
  }
  if (!validateProblemSet(input.problemSet)) {
    return { ok: false, message: 'problemSet is invalid' }
  }
  if (!validateConditions(input.conditions, input.mode as ChallengeMode)) {
    return { ok: false, message: 'conditions is invalid or does not match mode' }
  }
  if (!isFiniteNumberInRange(input.creatorScore, 0, MAX_SCORE)) {
    return { ok: false, message: 'creatorScore is invalid' }
  }

  return {
    ok: true,
    value: {
      creatorPlayerId: input.creatorPlayerId,
      creatorNickname: input.creatorNickname,
      creatorIcon: input.creatorIcon as AvatarRef,
      creatorEquippedTitle: input.creatorEquippedTitle ?? null,
      mode: input.mode as ChallengeMode,
      problemSet: input.problemSet as ChallengeProblemSet,
      conditions: input.conditions as ChallengeConditions,
      creatorScore: input.creatorScore as number,
    },
  }
}

/** Challenge IDとしてURLに載せる値の形式チェック（D1へクエリを投げる前の最終防衛）。 */
export function isValidChallengeId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(id)
}

export interface AttemptValidationResult {
  ok: boolean
  value?: CreateChallengeAttemptInput
  message?: string
}

/**
 * Ver.6 Phase 5.2（Challenge機能完成）: POST /api/challenges/:id/attemptsの入力検証。
 * challengeIdはURLパス由来（既にisValidChallengeIdで検証済みの前提）のためここでは
 * 見ない。resultやattemptNumberはクライアントから一切受け取らず、常にサーバー側
 * （index.ts）がcreatorScoreとの比較・countForPlayerの結果から確定させる
 * （クライアントが勝敗や挑戦回数を自己申告できる余地を一切残さない）。
 */
export function validateCreateChallengeAttemptInput(raw: unknown, challengeId: string): AttemptValidationResult {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, message: 'request body must be a JSON object' }
  }
  const input = raw as Partial<CreateChallengeAttemptInput>

  if (!isNonEmptyString(input.playerId, MAX_PLAYER_ID_LENGTH)) {
    return { ok: false, message: 'playerId is required' }
  }
  if (!isNonEmptyString(input.nickname, MAX_NICKNAME_LENGTH)) {
    return { ok: false, message: 'nickname is required' }
  }
  if (!validateAvatar(input.avatar)) {
    return { ok: false, message: 'avatar is invalid' }
  }
  if (!isValidEquippedTitle(input.equippedTitle)) {
    return { ok: false, message: 'equippedTitle must be a known title id or null' }
  }
  if (!isFiniteNumberInRange(input.score, 0, MAX_SCORE)) {
    return { ok: false, message: 'score is invalid' }
  }

  return {
    ok: true,
    value: {
      challengeId,
      playerId: input.playerId,
      nickname: input.nickname,
      avatar: input.avatar as AvatarRef,
      equippedTitle: input.equippedTitle ?? null,
      score: input.score as number,
    },
  }
}
