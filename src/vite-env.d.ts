/// <reference types="vite/client" />

/**
 * Vercel Previewでのみ有効な確認用画面（OverdrivePreviewScreen）の到達可否を、
 * ビルド時に静的に決めるフラグ。vite.config.tsのdefineで注入する。
 * VERCEL_ENV==='production'のビルドでは必ずfalseになり、コード上も
 * 到達不能（本番挙動に一切影響しない）。
 */
declare const __DOPAGAKI_PREVIEW_ENABLED__: boolean
