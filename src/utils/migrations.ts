import { ENDLESS_DIFFICULTIES } from '../config/endlessConfig'
import {
  checkDopaPercentAchievements,
  checkEndlessAchievements,
  checkWorldBattleStreakAchievements,
  checkWorldBattleWinAchievements,
} from './achievementStorage'
import { getWorldBattleStats } from './battleStatsStorage'
import { localHeartRepository } from './heartRepository'
import { getBestPercent, getEndlessBest } from './storage'
import type { AchievementId } from '../types'

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
 *   - checkEndlessAchievements: Endless初級/中級/上級それぞれの既存BEST記録から、
 *     新設した12個のSTREAK実績を遡及解除する。
 *
 * v3（Ver.6 Phase 10: 実績拡張ラウンド、68個化）: 既存v1/v2のロジックは一切変更せず、
 * 追加のステップとしてのみ以下を行う。
 *   - checkEndlessAchievements: 新設したENDLESS追加3段（初級150/中級75/上級50）を、
 *     既存BEST記録に対して再チェックする（v2と同じ関数呼び出しを安全に繰り返すだけ）。
 *   - checkWorldBattleWinAchievements/checkWorldBattleStreakAchievements: 既存の
 *     battleStatsStorage（wins/maxStreak、Ver.6 Phase 6で導入済み）から、世界対戦の
 *     勝利数ladder・連勝ladderを遡及解除する。
 *
 * v3では意図的に遡及解除しないもの（保存されていない事実を推測しないため）:
 *   - ノーミス/完全体（過去のプレイで正答率100%だったかどうかは保存されていない）。
 *   - Challenge作成/参加/勝利/防衛・指名手配（このラウンド以前はローカルに累計を
 *     一切持っていなかった。既存のcreatedChallengeIds/participatedChallengeIdsは
 *     「IDの一覧」であって「勝敗の累計」ではないため、件数から勝敗数を推測しない）。
 *   - 世界対戦の初プレイ/初DRAW（battleStatsStorageはwins/maxStreakしか保存して
 *     おらず、「プレイしたが一度も勝っていない」「一度もDRAWしていない」場合との
 *     区別がつかない）。
 *   - フレンド対戦（累計プレイ回数はこのラウンド以前は一切保存されていなかった）。
 *   - Grind（公式プレイ回数はこのラウンドで新設したofficialPlayCountV1が0から
 *     始まる。既存のplayCountV4は「Challenge/Battleリプレイも誤って加算していた」
 *     汚染済みの値のため、これをそのままコピーして使わない）。
 *
 * v4（次フェーズ: DOPA HEART本実装、item 18）: 既存ユーザー・新規ユーザーの区別なく、
 * Heartデータ（utils/heartRepository.ts）をまだ一度も読んでいなければ、この時点で
 * 5 Heartから開始する状態を作る（heartRepository.ts自身も未保存時に同じ初期化を行う
 * 遅延初期化を持つため、実質的にはここでgetHeartCount()を1回呼ぶだけで十分——
 * 既存のProfile/Achievement/record等は一切読み書きしないため、それらを壊す余地が
 * ない）。
 */
const MIGRATION_VERSION_KEY = 'dopagaki:migrationVersionV1'
const CURRENT_MIGRATION_VERSION = 4

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
 *
 * Ver.6 Phase 10（実績拡張ラウンド、item 18）: 遡及解除で新たに解除された実績ID一覧を
 * 戻り値として返す（各checkX関数はunlockMatching経由で「今回新たに解除したID」だけを
 * 返すため、重複解除分は自然に混ざらない）。呼び出し元（App.tsx）はこれを他の実績解除と
 * 同じAchievementUnlockBannerへそのまま渡すことで、1〜3件は順番表示・4件以上は
 * 「実績をN個解除！」サマリーへ自動的にまとまる（個別の仕組みを別途作らない）。
 */
export function runMigrationsOnce(): AchievementId[] {
  const current = readMigrationVersion()
  if (current >= CURRENT_MIGRATION_VERSION) return []

  const unlocked: AchievementId[] = []

  if (current < 1) {
    unlocked.push(...checkDopaPercentAchievements(getBestPercent()))
  }

  if (current < 2) {
    unlocked.push(...checkDopaPercentAchievements(getBestPercent()))
    // 次フェーズ（item 137-140、大型最終仕上げラウンド）: 旧dopa490「最後の一問」（490%
    // 到達だけで解除）はここで遡及解除していたが、この実績自体を削除したため行も削除した。
    // 新設のSECRET「全部水の泡」（FINAL QUESTIONに到達しながら不正解に終わった、という
    // 一度きりの出来事）は保存された記録から安全に推論できないため、遡及解除の対象にしない。
    for (const difficulty of ENDLESS_DIFFICULTIES) {
      unlocked.push(...checkEndlessAchievements(difficulty, getEndlessBest(difficulty)))
    }
  }

  if (current < 3) {
    for (const difficulty of ENDLESS_DIFFICULTIES) {
      unlocked.push(...checkEndlessAchievements(difficulty, getEndlessBest(difficulty)))
    }
    const battleStats = getWorldBattleStats()
    unlocked.push(...checkWorldBattleWinAchievements(battleStats.wins))
    unlocked.push(...checkWorldBattleStreakAchievements(battleStats.maxStreak))
  }

  if (current < 4) {
    localHeartRepository.getHeartCount()
  }

  writeMigrationVersion(CURRENT_MIGRATION_VERSION)
  return unlocked
}
