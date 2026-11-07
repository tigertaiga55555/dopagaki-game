/**
 * Ver.5.0追加: Google Analytics 4（測定ID G-1BRJXLJ9P7、index.htmlのgtag snippet参照）への
 * カスタムイベント送信をこの1箇所に集約する。
 *
 * gtag関数はindex.htmlの同期スクリプトでwindow上に必ず定義される（GA4本体スクリプトの
 * 読み込み自体は非同期だが、gtag()はdataLayer.pushの薄いラッパーとして即座に使える）ため、
 * 通常はここでwindow.gtagが存在しないことはない。ただし広告ブロッカー等でGA4スクリプトの
 * 読み込み自体がブロックされるとdataLayer.pushが実質的な何もしない操作になるだけで、
 * ゲーム側の処理には一切影響しない（trackEvent自体もtypeof window.gtagのチェックで
 * 存在しない場合は静かに何もしない安全な実装にしている）。
 *
 * 送信するのは標準の自動収集パラメータとイベント名・final_percentのみで、
 * 個人を特定できる情報は一切含めない。
 */

type GtagFn = (...args: unknown[]) => void

declare global {
  interface Window {
    gtag?: GtagFn
    dataLayer?: unknown[]
  }
}

function trackEvent(name: string, params?: Record<string, string | number | boolean>) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', name, params)
}

/** ゲーム開始（タイトルからのSTART・結果画面からのリトライの両方で発火）。 */
export function trackGameStart(): void {
  trackEvent('game_start')
}

/** 100％到達・DOPA OVERDRIVE突入。 */
export function trackOverdriveReached(): void {
  trackEvent('overdrive_reached')
}

/** 120％到達・FINAL DOPA TRIAL突入。 */
export function trackFinalReached(): void {
  trackEvent('final_reached')
}

/** ULTIMATE QUESTION（FINAL DOPA TRIAL Q16）到達。 */
export function trackUltimateReached(): void {
  trackEvent('ultimate_reached')
}

/** 200％ PERFECT CLEAR。 */
export function trackPerfectClear(): void {
  trackEvent('perfect_clear')
}

/** 結果画面表示。最終ドパガキ度をfinal_percentとして送信する。 */
export function trackResultView(finalPercent: number): void {
  trackEvent('result_view', { final_percent: finalPercent })
}

/** 結果シェアボタン（「画像付きでシェア」）押下。 */
export function trackShareClick(): void {
  trackEvent('share_click')
}

/** 結果画面からの再プレイ。 */
export function trackReplayStart(): void {
  trackEvent('replay_start')
}

/**
 * Ver.6 Phase 1追加: 各マイルストーン到達を、既存のoverdrive_reached/final_reached/
 * perfect_clearとは別名の指標としても送信する（既存イベントの置き換えではなく追加）。
 * 呼び出し元は既存イベントと同じガード条件（1プレイにつき1回だけ）を利用する。
 */
export function trackReach100(): void {
  trackEvent('reach_100')
}

export function trackReach120(): void {
  trackEvent('reach_120')
}

export function trackReach200(): void {
  trackEvent('reach_200')
}

/** 500％チャレンジ開始（説明画面の「500％に挑戦する」ボタン押下）。 */
export function trackChallenge500Start(): void {
  trackEvent('challenge_500_start')
}

export function trackReach300(): void {
  trackEvent('reach_300')
}

export function trackReach400(): void {
  trackEvent('reach_400')
}

export function trackReach500(): void {
  trackEvent('reach_500')
}

/**
 * Ver.6 Phase 4: Endlessモード開始（難易度選択画面でのボタン押下）。
 * QA/Previewモードでは送信しない既存方針（engine/useChallenge500.tsのqaModeガードと同様）を
 * 呼び出し元（engine/useEndlessGame.ts）側で維持する——この関数自体は常に送信する薄いラッパー
 * のままにし、送信抑制の判断はhook側に一本化する既存設計を踏襲する。
 */
export function trackEndlessStart(difficulty: string): void {
  trackEvent('endless_start', { difficulty })
}

/** Endlessモード終了（1 MISS・時間切れのいずれでも1回だけ）。 */
export function trackEndlessEnd(difficulty: string, score: number, isNewBest: boolean): void {
  trackEvent('endless_end', { difficulty, score, is_new_best: isNewBest })
}

/**
 * Ver.6 Phase 5（Profile/Achievement/Ranking基盤）: Profile画面を開いた回数。
 * QA/Previewでは送信しない既存方針を呼び出し元（画面側）が維持する。
 */
export function trackProfileView(): void {
  trackEvent('profile_view')
}

/** プロフィール編集（ニックネーム・アイコン）を保存した回数。 */
export function trackProfileEdit(): void {
  trackEvent('profile_edit')
}

/** 実績を新規解除した瞬間（achievementIdのみ送信、個人情報は含まない）。 */
export function trackAchievementUnlock(achievementId: string): void {
  trackEvent('achievement_unlock', { achievement_id: achievementId })
}

/** 称号を装備した回数（titleId=nullの「未装備に戻す」も送信対象）。 */
export function trackTitleEquipped(titleId: string | null): void {
  trackEvent('title_equipped', { title_id: titleId ?? 'none' })
}

/** Ranking画面を開いた回数。 */
export function trackRankingView(): void {
  trackEvent('ranking_view')
}

/**
 * Ver.6 Phase 5.2（Challenge機能完成）: Challengeライフサイクルのイベント。
 * challengeIdやplayerIdなど個人・記録を特定できる識別情報は一切送信せず、modeだけを
 * 送る（既存のtrackEndlessStart等と同じ「個人を特定できる情報を含めない」方針）。
 * QA/Previewでは送信しない既存方針を呼び出し元（画面側）が維持する。
 */
export function trackChallengeCreated(mode: string): void {
  trackEvent('challenge_created', { mode })
}

/** Challenge受信画面を開いた回数（URLを開いた瞬間。本人が自分のChallengeを開いた場合も含む）。 */
export function trackChallengeOpened(mode: string): void {
  trackEvent('challenge_opened', { mode })
}

/** 「挑戦する」を押してChallengeのプレイを開始した回数。 */
export function trackChallengePlayed(mode: string): void {
  trackEvent('challenge_played', { mode })
}

/** Challengeの挑戦結果がWINだった回数。 */
export function trackChallengeWin(mode: string): void {
  trackEvent('challenge_win', { mode })
}
