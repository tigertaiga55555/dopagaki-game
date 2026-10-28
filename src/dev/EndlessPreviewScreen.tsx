import { useState } from 'react'
import { EndlessPlayScreen } from '../screens/EndlessPlayScreen'
import { EndlessResultScreen } from '../screens/EndlessResultScreen'
import { EndlessSelectScreen } from '../screens/EndlessSelectScreen'
import type { EndlessDifficulty } from '../types'
import type { EndlessFinishPayload } from '../engine/useEndlessGame'

type Phase = 'select' | 'playing' | 'result'

/**
 * Ver.6 Phase 4 QA補助専用画面（Cloudflare Previewのみ到達）: ?preview=endless
 *
 * 本番のApp.tsx通常遷移（TitleScreen→EndlessSelectScreen→EndlessPlayScreen→
 * EndlessResultScreen）と完全に同じ本番コンポーネントをそのまま再利用し、Endless専用の
 * 確認用コードは複製しない。唯一の違いはEndlessPlayScreenへqaMode={true}を渡すことで、
 * GA4のendless_start/endless_end送信とlocalStorageの自己ベスト更新を抑制する点だけ
 * （Challenge500QaPreviewScreen.tsxと同じ方針）。初級/中級/上級それぞれへすぐ移動できる
 * よう、難易度選択画面から始める構成にしている。
 */
export function EndlessPreviewScreen() {
  const [phase, setPhase] = useState<Phase>('select')
  const [difficulty, setDifficulty] = useState<EndlessDifficulty>('beginner')
  const [result, setResult] = useState<EndlessFinishPayload | null>(null)
  const [playKey, setPlayKey] = useState(0)

  function handleSelect(d: EndlessDifficulty) {
    setDifficulty(d)
    setPlayKey((k) => k + 1)
    setPhase('playing')
  }

  function handleFinish(payload: EndlessFinishPayload) {
    setResult(payload)
    setPhase('result')
  }

  return (
    <div className="relative min-h-dvh">
      <div
        className="pointer-events-none fixed left-1/2 z-[70] -translate-x-1/2 whitespace-nowrap rounded-full bg-fuchsia-500/20 px-3 py-1 text-[10px] font-black tracking-widest text-fuchsia-200"
        style={{ top: 'calc(env(safe-area-inset-top) + 2.75rem)' }}
      >
        🔧 ENDLESS QA PREVIEW（本番には出ません）
      </div>

      {phase === 'select' && <EndlessSelectScreen onSelect={handleSelect} onQuit={() => setPhase('select')} />}

      {phase === 'playing' && (
        <EndlessPlayScreen
          key={playKey}
          difficulty={difficulty}
          qaMode
          onFinish={handleFinish}
          onQuit={() => setPhase('select')}
        />
      )}

      {phase === 'result' && result && (
        <EndlessResultScreen
          difficulty={difficulty}
          score={result.score}
          best={result.best}
          isNewBest={result.isNewBest}
          onRetry={() => handleSelect(difficulty)}
          onChangeDifficulty={() => setPhase('select')}
          onHome={() => setPhase('select')}
        />
      )}
    </div>
  )
}
