/**
 * Ver.2「ドパガキゲーム」の数値設定。
 * イベントの時間・採点基準・煽り発生条件などはすべてここに集約する。
 * ここの数値を変えるだけで、コードを触らずにゲームバランスを調整できる。
 */

/** 経過時間（ms）に応じてスコアを決めるための帯。value <= maxMs の最初の帯のスコアを採用し、
 *  どの帯にも当てはまらなければ fallback を使う。 */
export interface TimeBand {
  maxMs: number
  score: number
}

/** 回数に応じてスコアを決めるための帯。value <= max の最初の帯のスコアを採用する。 */
export interface CountBand {
  max: number
  score: number
}

export const V2_CONFIG = {
  /** このスコア以上のとき「犯行記録」候補にする */
  crimeThreshold: 55,
  /** このスコア以上のとき、そのイベント終了後に煽り文を表示する候補にする */
  tauntThreshold: 60,
  /** 煽り文を表示する時間（仕様上 1.8〜2.5秒は読めるようにする） */
  tauntDurationMs: 2200,
  /** イベント間の短いトランジション（間延び防止と切り替わりの分かりやすさの両立） */
  transitionMs: 350,
  /** 中盤でプールからランダムに選ぶイベント数 */
  middleEventCount: 6,
  /** window.location.href が取得できない環境向けのフォールバックURL */
  shareUrl: 'https://dopagaki-game.example.com',

  events: {
    skip: {
      readDelayMs: 600,
      autoAdvanceMs: 4200,
      bands: [
        { maxMs: 1200, score: 90 },
        { maxMs: 2000, score: 70 },
        { maxMs: 3000, score: 45 },
      ] satisfies TimeBand[],
      fallbackScore: 15,
    },
    loading: {
      rampMs: 1600,
      skipLinkDelayMs: 800,
      autoAdvanceMs: 3500,
      bands: [
        { maxMs: 800, score: 90 },
        { maxMs: 1600, score: 65 },
        { maxMs: 2500, score: 40 },
      ] satisfies TimeBand[],
      fallbackScore: 10,
    },
    rapidTap: {
      enableMs: 2500,
      tapBands: [
        { max: 0, score: 10 },
        { max: 2, score: 40 },
        { max: 5, score: 65 },
        { max: 10, score: 85 },
      ] satisfies CountBand[],
      fallbackScore: 97,
    },
    notification: {
      showDelayMinMs: 1500,
      showDelayMaxMs: 2500,
      autoAdvanceMs: 5000,
      bands: [
        { maxMs: 600, score: 95 },
        { maxMs: 1500, score: 70 },
        { maxMs: 3000, score: 45 },
      ] satisfies TimeBand[],
      fallbackScore: 15,
    },
    stimulusFree: {
      buttonDelayMs: 1000,
      totalMs: 5000,
      bands: [
        { maxMs: 1000, score: 85 },
        { maxMs: 2500, score: 60 },
        { maxMs: 4000, score: 35 },
      ] satisfies TimeBand[],
      fallbackScore: 10,
    },
    shortContent: {
      totalMs: 6000,
      swipeThresholdPx: 60,
      bands: [
        { maxMs: 1500, score: 90 },
        { maxMs: 3000, score: 65 },
        { maxMs: 5000, score: 40 },
      ] satisfies TimeBand[],
      fallbackScore: 10,
    },
    tapSpeed: {
      totalMs: 4500,
      hintDelayMs: 1000,
      tapBands: [
        { max: 0, score: 10 },
        { max: 2, score: 35 },
        { max: 5, score: 55 },
        { max: 10, score: 75 },
      ] satisfies CountBand[],
      fallbackScore: 95,
    },
    unresponsive: {
      totalMs: 3500,
      interactionBands: [
        { max: 0, score: 10 },
        { max: 2, score: 45 },
        { max: 5, score: 70 },
      ] satisfies CountBand[],
      fallbackScore: 90,
    },
    instantReward: {
      waitMs: 5000,
      autoTimeoutMs: 7000,
      bands: [
        { maxMs: 1000, score: 90 },
        { maxMs: 2500, score: 65 },
      ] satisfies TimeBand[],
      fallbackScoreImmediate: 45,
      waitScore: 10,
      timeoutScore: 20,
    },
    speedToggle: {
      totalMs: 5000,
      bands: [
        { maxMs: 800, score: 90 },
        { maxMs: 2000, score: 65 },
        { maxMs: 4000, score: 40 },
      ] satisfies TimeBand[],
      fallbackScore: 10,
    },
    fakeResult: {
      autoAdvanceMs: 5000,
      messageMs: 1500,
      bands: [
        { maxMs: 1000, score: 90 },
        { maxMs: 2500, score: 60 },
      ] satisfies TimeBand[],
      fallbackScorePressed: 25,
      fallbackScoreIgnored: 10,
    },
    finalTrap: {
      countdownMs: 3000,
      bands: [
        { maxMs: 1000, score: 95 },
        { maxMs: 2000, score: 70 },
        { maxMs: 3000, score: 45 },
      ] satisfies TimeBand[],
      fallbackScore: 10,
    },
  },
}

export function scoreByElapsed(elapsedMs: number, bands: TimeBand[], fallback: number): number {
  for (const band of bands) {
    if (elapsedMs <= band.maxMs) return band.score
  }
  return fallback
}

export function scoreByCount(count: number, bands: CountBand[], fallback: number): number {
  for (const band of bands) {
    if (count <= band.max) return band.score
  }
  return fallback
}
