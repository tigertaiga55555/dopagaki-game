import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    // Vercelは全ビルドにVERCEL_ENV（'production' | 'preview' | 'development'）を自動設定する。
    // Production以外（Preview・ローカル開発）でのみ、OVERDRIVE演出確認用画面を到達可能にする。
    // Productionビルドではこの定数がリテラルfalseとしてインライン化され、
    // 確認用画面のコードパスは実行時に到達し得ない。
    __DOPAGAKI_PREVIEW_ENABLED__: JSON.stringify(process.env.VERCEL_ENV !== 'production'),
  },
})
