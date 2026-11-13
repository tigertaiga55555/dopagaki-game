import { useEffect, useState } from 'react'
import { BackButton } from '../components/BackButton'
import { RANKING_CATEGORIES, localRankingDataSource } from '../utils/rankingRepository'
import { trackRankingView } from '../utils/analytics'
import type { RankingCategoryId } from '../types'

interface Props {
  onBack: () => void
}

/**
 * Ver.6 Phase 5（Profile/Achievement/Ranking基盤）: Ranking画面。
 *
 * 今回バックエンドを一切導入していないため、オンライン順位データは存在しない。
 * 絶対に架空プレイヤー・ダミー順位・偽ONLINE人数を表示しない——「あなたの記録」
 * だけを表示し、順位そのものは一切描画しない（comingSoonでないカテゴリも同様）。
 * データはutils/rankingRepository.ts（RankingDataSource）経由でのみ取得し、
 * このコンポーネントからlocalStorageを直接参照しない。
 */
export function RankingScreen({ onBack }: Props) {
  const [selected, setSelected] = useState<RankingCategoryId>('maxDopaPercent')
  const category = RANKING_CATEGORIES.find((c) => c.id === selected)!
  const myValue = localRankingDataSource.getMyValue(selected)

  useEffect(() => {
    trackRankingView()
  }, [])

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <BackButton onBack={onBack} label="戻る" />

      <div className="flex flex-1 flex-col items-center gap-4 px-6 py-4">
        <h1 className="text-lg font-black tracking-widest text-white">RANKING</h1>

        <div className="grid w-full max-w-xs grid-cols-2 gap-2">
          {RANKING_CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={`rounded-xl px-2 py-2.5 text-center text-[11px] font-bold leading-tight transition-transform active:scale-95 ${
                selected === c.id ? 'bg-gradient-to-b from-fuchsia-500 to-purple-600 text-white' : 'bg-white/5 text-white/60'
              } ${c.comingSoon ? 'opacity-70' : ''}`}
            >
              {c.label}
              {c.comingSoon && <span className="mt-0.5 block text-[9px] font-black tracking-widest text-white/50">準備中</span>}
            </button>
          ))}
        </div>

        <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-white/5 px-5 py-6 text-center">
          <p className="text-xs font-bold tracking-widest text-white/40">{category.label}</p>
          {category.comingSoon || myValue === null ? (
            <p className="mt-3 text-sm font-bold leading-relaxed text-white/50">
              ランキングはVer.6正式公開時に
              <br />
              利用可能になります
            </p>
          ) : (
            <>
              <p className="mt-2 text-4xl font-black tabular-nums text-white">
                {myValue}
                <span className="ml-1 text-lg text-white/50">{category.unit}</span>
              </p>
              <p className="mt-2 text-[11px] font-bold text-white/40">あなたのBEST（オンライン順位は未接続のため非表示）</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
