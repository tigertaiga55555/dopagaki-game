/// <reference types="vite/client" />

/**
 * Preview環境でのみ有効な確認用画面（OverdrivePreviewScreen等）の到達可否を、
 * ビルド時に静的に決めるフラグ。vite.config.tsのdefineで注入する。
 * Production向けビルド（Vercel: VERCEL_ENV==='production' / Cloudflare Workers Builds:
 * WORKERS_CI_BRANCH==='main'）では必ずfalseになり、コード上も到達不能
 * （本番挙動に一切影響しない）。
 */
declare const __DOPAGAKI_PREVIEW_ENABLED__: boolean
