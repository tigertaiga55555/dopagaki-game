import { useEffect, useState } from 'react'
import { BackButton } from '../components/BackButton'
import { fetchBattlePerformance, fetchBattleStats, type BattlePerformanceResponse, type BattleStatsResponse } from '../battle/battleClient'
import { getOrCreatePlayerId } from '../utils/profileStorage'

interface Props {
  onBack: () => void
}

const DECIDED_BY_LABEL: Record<string, string> = {
  finalDopaPercent: '最終DOPA%',
  baseDopaPercent: '基礎DOPA%',
  accuracy: '正答率',
  maxCombo: '最大COMBO',
  medianCorrectReactionMs: '反応速度',
  exactTie: '完全同値（DRAW）',
}

/**
 * 次フェーズ（DOPA PASS基盤ラウンド、item 28）: PASS限定の詳細分析画面。
 *
 * 誠実な設計方針（ユーザー指示）: 実際に記録されているデータだけを表示する。
 * - 世界対戦の勝敗・平均DOPA%/正答率/COMBO/反応速度・決着理由別勝数は
 *   battle_matches/player_battle_stats（既に本番で記録済みのD1テーブル）から正しく
 *   集計できる、新しい列の追加は不要だった既存データ。
 * - DOPA RUSH/ENDLESSの「1回ごとの履歴」・World Battleの「対戦相手名の履歴」は、
 *   現時点でどこにも記録されていない——これをこの画面のために偽造・推測することは
 *   しない。正直にギャップとして明記し、将来ラウンドでの実装対象として残す。
 */
export function PassAnalyticsScreen({ onBack }: Props) {
  const [stats, setStats] = useState<BattleStatsResponse | null>(null)
  const [performance, setPerformance] = useState<BattlePerformanceResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const playerId = getOrCreatePlayerId()
    Promise.all([fetchBattleStats(playerId), fetchBattlePerformance(playerId)]).then(([s, p]) => {
      setStats(s)
      setPerformance(p)
      setLoading(false)
    })
  }, [])

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <BackButton onBack={onBack} label="プロフィール" />

      <div className="flex flex-1 flex-col items-center gap-4 px-6 py-4">
        <h1 className="text-lg font-black tracking-widest text-amber-300">DOPA PASS 詳細分析</h1>
        <p className="text-[11px] text-white/40">※ 現時点では世界対戦のデータのみ集計対象です</p>

        {loading && <p className="mt-10 text-sm text-white/40">読み込み中…</p>}

        {!loading && stats && (
          <div className="w-full max-w-xs space-y-2 rounded-2xl bg-white/5 px-4 py-4">
            <p className="mb-1 text-[10px] font-black tracking-widest text-white/40">世界対戦 戦績</p>
            <Row label="勝利" value={`${stats.wins}`} />
            <Row label="敗北" value={`${stats.losses}`} />
            <Row label="引き分け" value={`${stats.draws}`} />
            <Row label="現在の連勝" value={`${stats.currentStreak}`} />
            <Row label="最大連勝" value={`${stats.maxStreak}`} />
          </div>
        )}

        {!loading && performance && performance.sampleSize > 0 && (
          <>
            <div className="w-full max-w-xs space-y-2 rounded-2xl bg-white/5 px-4 py-4">
              <p className="mb-1 text-[10px] font-black tracking-widest text-white/40">
                平均パフォーマンス（直近{performance.sampleSize}戦）
              </p>
              <Row label="平均 最終DOPA%" value={`${performance.avgFinalDopaPercent.toFixed(1)}%`} />
              <Row label="平均 基礎DOPA%" value={`${performance.avgBaseDopaPercent.toFixed(1)}%`} />
              <Row label="平均 正答率" value={`${(performance.avgAccuracy * 100).toFixed(1)}%`} />
              <Row label="平均 最大COMBO" value={`${performance.avgMaxCombo.toFixed(1)}`} />
              <Row
                label="平均 反応速度"
                value={performance.avgMedianReactionMs === null ? '—' : `${Math.round(performance.avgMedianReactionMs)}ms`}
              />
            </div>

            <div className="w-full max-w-xs space-y-2 rounded-2xl bg-white/5 px-4 py-4">
              <p className="mb-1 text-[10px] font-black tracking-widest text-white/40">決着理由別勝利数</p>
              {Object.entries(performance.winsByDecidedBy)
                .filter(([key]) => key in DECIDED_BY_LABEL)
                .map(([key, value]) => <Row key={key} label={DECIDED_BY_LABEL[key]} value={`${value}勝`} />)}
            </div>
          </>
        )}

        {!loading && (!performance || performance.sampleSize === 0) && (
          <p className="mt-4 text-xs text-white/30">まだ集計できる世界対戦の記録がありません</p>
        )}

        <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="mb-1 text-[10px] font-black tracking-widest text-white/30">今後追加予定のデータ（現在は未記録）</p>
          <p className="text-[11px] leading-relaxed text-white/30">
            DOPA RUSH/ENDLESSの1回ごとの履歴、World Battleの対戦相手ごとの履歴は、現時点ではまだ記録されていません。
          </p>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-white/60">{label}</span>
      <span className="font-bold tabular-nums text-white">{value}</span>
    </div>
  )
}
