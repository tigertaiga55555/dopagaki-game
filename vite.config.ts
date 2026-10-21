import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Vercelは全ビルドにVERCEL_ENV（'production' | 'preview' | 'development'）を自動設定するが、
// Cloudflare Workers Buildsはこれを設定せず、代わりにビルド対象ブランチ名をWORKERS_CI_BRANCHへ
// 入れる（Production環境として設定したブランチかどうかはWORKERS_CI_BRANCH側で判定する必要が
// ある）。どちらの変数も存在しない場合（ローカルのvite dev/vite preview）は、既存どおり
// 「Production外」として扱う（確認用画面を到達可能にする）。
function isProductionBuild(): boolean {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === 'production'
  if (process.env.WORKERS_CI_BRANCH) return process.env.WORKERS_CI_BRANCH === 'main'
  return false
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    // Production以外（Preview・ローカル開発）でのみ、OVERDRIVE演出確認用画面を到達可能にする。
    // Productionビルドではこの定数がリテラルfalseとしてインライン化され、
    // 確認用画面のコードパスは実行時に到達し得ない。
    __DOPAGAKI_PREVIEW_ENABLED__: JSON.stringify(!isProductionBuild()),
  },
})
