import { CHALLENGE500_CONFIG } from '../config/challenge500Config'
import { ENDLESS_DIFFICULTIES } from '../config/endlessConfig'
import { checkDopaPercentAchievements, checkEndlessAchievements, checkFinalQuestionAchievement } from './achievementStorage'
import { getBestPercent, getEndlessBest } from './storage'

/**
 * Ver.6 Phase 5（Profile/Achievement/Ranking基盤）: バージョン管理されたマイグレーション。
 *
 * 既存ユーザーのlocalStorageデータ（通常モードBEST・EndlessBEST等）は絶対に壊さない
 * （localStorage.clear等は一切使わない）。このファイルが行うのは「既に保存されている
 * 記録を読んで、新しいAchievement機構へ反映する」という追加だけで、既存キーへの
 * 書き込みは一切発生しない。
 *
 * v1: 既存のbestPercentV4（通常モード・FINAL DOPA TRIAL・Challenge500のいずれで
 * 到達した値も同じキーに保存されている、utils/storage.ts参照）から、DOPA%実績を
 * 遡及解除する。これにより、Achievement機構導入前から100%以上に到達していた
 * 既存ユーザーの実績が失われない。
 *
 * v2（Ver.6 Phase 5.1: Achievement拡充）: 既存v1のロジックは一切変更せず、追加の
 * ステップとしてのみ以下を行う。
 *   - checkDopaPercentAchievements: 新設した50/150/250/350/450%の閾値を、既存の
 *     bestPercentV4へ対して再チェックする（既に解除済みの閾値は重複解除防止により
 *     無視されるだけなので、v1と同じ呼び出しを安全に繰り返せる）。
 *   - checkFinalQuestionAchievement: 490%（FINAL QUESTION）はbestPercentV4の値として
 *     残らないため直接は遡及できないが、bestPercentV4が500%に達している場合は
 *     「500%クリアの直前に必ず490%を通過している」という状態遷移の性質
 *     （engine/challenge500Engine.ts参照）から安全に推論して解除する。
 *   - checkEndlessAchievements: Endless初級/中級/上級それぞれの既存BEST記録から、
 *     新設した12個のSTREAK実績を遡及解除する。
 */
const MIGRATION_VERSION_KEY = 'dopagaki:migrationVersionV1'
const CURRENT_MIGRATION_VERSION = 2

function readMigrationVersion(): number {
  try {
    const raw = localStorage.getItem(MIGRATION_VERSION_KEY)
    const value = raw ? Number(raw) : 0
    return Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}

function writeMigrationVersion(version: number): void {
  try {
    localStorage.setItem(MIGRATION_VERSION_KEY, String(version))
  } catch {
    // 書き込みに失敗しても次回ロード時に再試行されるだけで、既存データへの影響はない。
  }
}

/**
 * アプリ起動時に1回呼ぶ。CURRENT_MIGRATION_VERSIONに到達済みなら即座に何もしない
 * （冪等。何度呼んでも安全）。
 */
export function runMigrationsOnce(): void {
  const current = readMigrationVersion()
  if (current >= CURRENT_MIGRATION_VERSION) return

  if (current < 1) {
    checkDopaPercentAchievements(getBestPercent())
  }

  if (current < 2) {
    checkDopaPercentAchievements(getBestPercent())
    checkFinalQuestionAchievement(getBestPercent() >= CHALLENGE500_CONFIG.clearPercent)
    for (const difficulty of ENDLESS_DIFFICULTIES) {
      checkEndlessAchievements(difficulty, getEndlessBest(difficulty))
    }
  }

  writeMigrationVersion(CURRENT_MIGRATION_VERSION)
}
