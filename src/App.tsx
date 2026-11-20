import { useCallback, useEffect, useRef, useState } from 'react'
import { Challenge500QaPreviewScreen } from './dev/Challenge500QaPreviewScreen'
import { EndlessPreviewScreen } from './dev/EndlessPreviewScreen'
import { FinalTrialPreviewScreen } from './dev/FinalTrialPreviewScreen'
import { OverdrivePreviewScreen } from './dev/OverdrivePreviewScreen'
import {
  isChallenge500QaPreviewRequested,
  isClear200PreviewRequested,
  isEndlessPreviewRequested,
  isFinalQuestionPreviewRequested,
  isFinalTrialPreviewRequested,
  isOverdrivePreviewRequested,
} from './dev/overdrivePreview'
import type { EndlessFinishPayload } from './engine/useEndlessGame'
import { AchievementScreen } from './screens/AchievementScreen'
import { ChallengeHistoryScreen } from './screens/ChallengeHistoryScreen'
import { ChallengePlayScreen } from './screens/ChallengePlayScreen'
import { ChallengeReceiveScreen } from './screens/ChallengeReceiveScreen'
import { ChallengeResultScreen } from './screens/ChallengeResultScreen'
import { ChallengeSentScreen } from './screens/ChallengeSentScreen'
import { EndlessPlayScreen } from './screens/EndlessPlayScreen'
import { EndlessResultScreen } from './screens/EndlessResultScreen'
import { EndlessSelectScreen } from './screens/EndlessSelectScreen'
import { ParticipatedChallengesScreen } from './screens/ParticipatedChallengesScreen'
import { PassAnalyticsScreen } from './screens/PassAnalyticsScreen'
import { PassPaywallScreen } from './screens/PassPaywallScreen'
import { PlayScreen } from './screens/PlayScreen'
import { ProfileEditScreen } from './screens/ProfileEditScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import { RankingScreen } from './screens/RankingScreen'
import { ResultScreen } from './screens/ResultScreen'
import { SentChallengesScreen } from './screens/SentChallengesScreen'
import { BattleHomeScreen } from './screens/battle/BattleHomeScreen'
import { BattleMatchScreen } from './screens/battle/BattleMatchScreen'
import { FriendBattleScreen } from './screens/battle/FriendBattleScreen'
import { PrivateEndlessMatchScreen } from './screens/battle/PrivateEndlessMatchScreen'
import { PrivateRoomHomeScreen } from './screens/battle/PrivateRoomHomeScreen'
import { PrivateRoomLobbyScreen } from './screens/battle/PrivateRoomLobbyScreen'
import { WorldMatchingScreen } from './screens/battle/WorldMatchingScreen'
import { TitleScreen } from './screens/TitleScreen'
import { addCreatedChallengeId } from './challenge/createdChallengesStorage'
import { extractChallengeIdFromLocation } from './challenge/url'
import { extractRoomCodeFromLocation } from './battle/battleUrl'
import { extractPrivateRoomCodeFromLocation } from './battle/privateRoomUrl'
import type { BattleFormat } from './battle/types'
import { trackChallengePlayed, trackGameStart, trackReplayStart, type PassPaywallSource } from './utils/analytics'
import { unlockAudio } from './utils/audioContext'
import { runMigrationsOnce } from './utils/migrations'
import { getOrCreatePlayerId, getProfile } from './utils/profileStorage'
import { sfx } from './utils/sound'
import { checkAndConsumeInterstitial, recordEligiblePlayCompleted } from './utils/adPolicyStorage'
import { qaLocalEntitlementRepository } from './payment/entitlementRepository'
import { localHeartRepository } from './utils/heartRepository'
import { getSubScreenBackTarget, resolveSubScreenOrigin, type SubScreenOrigin } from './utils/subScreenNavigation'
import type { BattleMode, BattleOpponentProfile } from './battle/types'
import type { ChallengeRecord } from './challenge/types'
import type { AchievementId, EndlessDifficulty, FinalResultV4, ScreenName } from './types'
import { AchievementUnlockBanner } from './components/AchievementUnlockBanner'
import { HeartEmptyModal } from './components/HeartEmptyModal'
import { MockInterstitialAd } from './components/MockInterstitialAd'

function toBattleProfile(profile: ReturnType<typeof getProfile>): BattleOpponentProfile {
  return { nickname: profile.nickname, avatar: profile.avatar, equippedTitleId: profile.equippedTitleId }
}

export default function App() {
  // Ver.6 Phase 5.2（Challenge機能完成）: Challenge URLを直接開いた場合（別端末で
  // 共有されたURLを開く場合を含む）、タイトル画面を経由せず直接Challenge受信画面へ
  // 入る。Ver.6 Phase 6: /battle/:roomCodeも同様にフレンド対戦の合流画面へ直接入る。
  // それ以外は常に従来どおりtitleから始まる。
  const [screen, setScreen] = useState<ScreenName>(() =>
    extractChallengeIdFromLocation()
      ? 'challengeReceive'
      : extractRoomCodeFromLocation()
        ? 'battleFriend'
        : extractPrivateRoomCodeFromLocation()
          ? 'privateRoomHome'
          : 'title',
  )
  const [result, setResult] = useState<FinalResultV4 | null>(null)
  const [playKey, setPlayKey] = useState(0)
  // Ver.6 Phase 5.2: Challenge専用の状態。通常ゲーム・Endlessとは完全に独立させる。
  const [challengeId] = useState(() => extractChallengeIdFromLocation())
  const [activeChallenge, setActiveChallenge] = useState<ChallengeRecord | null>(null)
  const [challengeResult, setChallengeResult] = useState<FinalResultV4 | null>(null)
  /** Ver.6 Phase 8（ENDLESS Challenge）: mode==='endless'の挑戦プレイ結果（STREAK数のみ、FinalResultV4は使わない）。 */
  const [challengeEndlessStreak, setChallengeEndlessStreak] = useState<number | null>(null)
  const [challengePlayKey, setChallengePlayKey] = useState(0)
  // Ver.6 Phase 6（1対1リアルタイム対戦）: Battle専用の状態。通常ゲーム・Challengeとは
  // 完全に独立させる。初期roomCodeは/battle/:roomCodeを直接開いた場合だけ使う。
  const [initialBattleRoomCode] = useState(() => extractRoomCodeFromLocation())
  // 次フェーズ（DOPA PASS基盤ラウンド、item 15 PRIVATE ROOM）: PRIVATE ROOM専用の状態。
  // 既存のbattleMatchとは完全に別（PRIVATE ROOM経由のNORMAL対戦もbattleMatchは使わず、
  // privateRoomMatchだけを使う——戻り先がprivateRoomLobbyになる点が既存battleMatchと違うため）。
  const [initialPrivateRoomCode] = useState(() => extractPrivateRoomCodeFromLocation())
  const [privateRoomCode, setPrivateRoomCode] = useState<string | null>(null)
  const [privateRoomMatch, setPrivateRoomMatch] = useState<{
    matchId: string
    battleType: BattleFormat
    endlessDifficulty: EndlessDifficulty | null
    opponentProfile: BattleOpponentProfile
  } | null>(null)
  const [battleMatch, setBattleMatch] = useState<{ matchId: string; mode: BattleMode; roomCode: string | null; opponent: BattleOpponentProfile | null } | null>(
    null,
  )
  // Ver.6 Phase 4: Endless専用の状態。通常ゲーム（screen/result/playKey）とは
  // 完全に独立させており、互いの画面遷移には一切影響しない。
  const [endlessDifficulty, setEndlessDifficulty] = useState<EndlessDifficulty>('beginner')
  const [endlessResult, setEndlessResult] = useState<EndlessFinishPayload | null>(null)
  const [endlessPlayKey, setEndlessPlayKey] = useState(0)
  // Vercel Previewかつ ?preview=overdrive の場合のみ、通常のタイトル/プレイ/結果の
  // 画面遷移を完全にバイパスして確認用画面を表示する。Productionでは
  // isOverdrivePreviewRequested()が常にfalseを返すため、この分岐には到達しない。
  const [showOverdrivePreview] = useState(isOverdrivePreviewRequested)
  // Ver.5.0: 同様に ?preview=finaltrial / finalquestion / clear200 の場合のみ、
  // FINAL DOPA TRIAL以降を確認する専用画面を表示する（51. 旧?preview=clear120は
  // 120%がもはやCLEARではなくなったため廃止し、finaltrialへ整理した）。
  const [showFinalTrialPreview] = useState(isFinalTrialPreviewRequested)
  const [showFinalQuestionPreview] = useState(isFinalQuestionPreviewRequested)
  const [showClear200Preview] = useState(isClear200PreviewRequested)
  // Ver.6 Phase 1 QA補助: ?preview=challenge500 の場合のみ、120〜200%の実プレイ・突入演出を
  // 一切経由せず「500%に挑戦」説明画面から直接始められるQA専用画面を表示する。
  const [showChallenge500QaPreview] = useState(isChallenge500QaPreviewRequested)
  // Ver.6 Phase 4 QA補助: ?preview=endless の場合のみ、Endlessの難易度選択画面から
  // 直接始められるQA専用画面を表示する。
  const [showEndlessPreview] = useState(isEndlessPreviewRequested)

  /**
   * Ver.6 Phase 5（Profile/Achievement/Ranking基盤）: アプリ起動時に1回だけ、匿名
   * player_idを確保し（なければ生成）、既存記録からのAchievement遡及マイグレーションを
   * 走らせる。どちらも冪等（何度呼んでも安全）で、既存のBEST等のキーには一切書き込まない。
   *
   * Ver.6 Phase 10（実績拡張ラウンド、item 18）: runMigrationsOnce()が新たに解除した
   * 実績IDをmigrationUnlockedへ保持し、最初に表示される画面（title）の上に既存の
   * AchievementUnlockBannerをそのまま重ねて表示する。質問応答中には絶対に表示されない
   * （マイグレーションはプレイ開始前の起動時にしか走らないため、構造的にプレイ中と
   * 重なることがない）。1〜3件は順番表示・4件以上は要約カードへ、という既存の
   * バッチング仕様をここでも別実装せず共有する。
   */
  const [migrationUnlocked, setMigrationUnlocked] = useState<AchievementId[]>([])
  useEffect(() => {
    getOrCreatePlayerId()
    setMigrationUnlocked(runMigrationsOnce())
  }, [])

  /**
   * Ver.5.0追加: GA4のgame_start（常に）とreplay_start（結果画面からのリトライ時のみ）を
   * ここで送信する。sourceはこの関数の呼び出し元（タイトルのSTART / 結果画面のリトライ）を
   * 区別するためだけの引数で、ゲームの開始処理自体（unlockAudio/sfx/画面遷移）は
   * sourceに関わらず完全に同一。
   */
  /**
   * 次フェーズ（DOPA HEART本実装、item 12）: DOPA RUSH/ENDLESSの開始直前にだけ所持数を
   * 確認する。0ならゲームを一切開始せず（音声unlock・GA4・画面遷移のいずれも発生させない）
   * HeartEmptyModalを表示するだけに留める。実際の消費（1個減らす）はここでは行わない
   * ——消費はPlayScreen/EndlessPlayScreen側で、カウントダウンが実際に進み始める瞬間に
   * だけ行う（item 9）。Challenge/Battle系のstartはこのチェックを一切経由しない
   * （item 13）。
   */
  const [heartEmptyEtaMs, setHeartEmptyEtaMs] = useState<number | null>(null)

  /**
   * 次フェーズ（DOPA PASS基盤ラウンド）: 強制インタースティシャルの「次のアクション時に
   * だけ挟む」仕組み。結果画面の上に即座には出さない——retry/home等、ユーザーが実際に
   * 次へ進もうとした操作をこの関数でラップし、しきい値＋クールダウンの両方を満たす
   * 場合だけ、実際の遷移（action）をMockInterstitialAdのonClose後まで保留する。
   */
  const [pendingAdAction, setPendingAdAction] = useState<(() => void) | null>(null)
  const maybeGateWithInterstitial = useCallback((action: () => void) => {
    if (checkAndConsumeInterstitial()) {
      setPendingAdAction(() => action)
    } else {
      action()
    }
  }, [])

  const startPlay = useCallback((source: 'title' | 'retry') => {
    // 次フェーズ（DOPA PASS基盤ラウンド、item 26）: DOPA PASS所有者はHeart 0チェック自体を
    // バイパスする（無料ユーザーの既存ロジックは一切変更しない）。
    if (!qaLocalEntitlementRepository.hasEntitlement('UNLIMITED_HEART') && localHeartRepository.getHeartCount() <= 0) {
      setHeartEmptyEtaMs(localHeartRepository.getNextRecoveryEtaMs() ?? 0)
      return
    }
    // iPhone SafariはAudioContextの生成/resumeをユーザー操作の同期コールバック内でしか許可しないため、
    // START/リトライの両方で使われるこのハンドラの中で必ず呼ぶ。
    unlockAudio()
    sfx.startPress()
    trackGameStart()
    if (source === 'retry') trackReplayStart()
    setPlayKey((k) => k + 1)
    setScreen('playing')
  }, [])

  const handleFinish = useCallback((result: FinalResultV4) => {
    // 次フェーズ（DOPA PASS基盤ラウンド）: DOPA RUSH/ENDLESS/World Battle合算の
    // 強制インタースティシャル対象カウンター（Challenge・ENDLESS Challenge・
    // PRIVATE ROOMでは呼ばない）。
    recordEligiblePlayCompleted()
    setResult(result)
    setScreen('result')
  }, [])

  /**
   * Ver.6準備: 画面右上の「やめる」ボタン用。onFinishを一切経由せずscreenを'title'へ
   * 戻すだけなので、結果計算（computeFinalResult等）もスコア保存（incrementPlayCount/
   * updateBestPercent、いずれもresultEngineV4.ts内でonFinish経由でのみ呼ばれる）も
   * 一切発生しない。PlayScreen（useRushGame）・FinalTrialScreen（useFinalTrial）は
   * このタイミングでアンマウントされ、両hookが既に持つuseEffectクリーンアップ
   * （RAFキャンセル・タイマー全クリア・BGM停止）がそのまま働くため、追加の後片付けは不要。
   */
  const quitToHome = useCallback(() => {
    setScreen('title')
  }, [])

  /**
   * Ver.6 Phase 4: ホーム画面の「ENDLESS」ボタン用。通常ゲームのstartPlayとは別経路
   * （unlockAudio/sfx.startPressは共有するが、trackGameStart/trackReplayStartは
   * Endless専用のtrackEndlessStart（useEndlessGame.ts側）と別イベントのため送らない）。
   */
  const openEndlessSelect = useCallback(() => {
    unlockAudio()
    sfx.startPress()
    setScreen('endlessSelect')
  }, [])

  const startEndless = useCallback((difficulty: EndlessDifficulty) => {
    if (!qaLocalEntitlementRepository.hasEntitlement('UNLIMITED_HEART') && localHeartRepository.getHeartCount() <= 0) {
      setHeartEmptyEtaMs(localHeartRepository.getNextRecoveryEtaMs() ?? 0)
      return
    }
    setEndlessDifficulty(difficulty)
    setEndlessPlayKey((k) => k + 1)
    setScreen('endlessPlaying')
  }, [])

  const handleEndlessFinish = useCallback((payload: EndlessFinishPayload) => {
    recordEligiblePlayCompleted()
    setEndlessResult(payload)
    setScreen('endlessResult')
  }, [])

  /**
   * Ver.6 Phase 5.2（Challenge機能完成）: Challengeの一連の画面遷移。
   * フラットな遷移モデル（バックスタックを持たない）を既存のEndless/Profile系と
   * 統一し、activeChallengeという単一の状態をsent/receive/play/result/historyの
   * どの画面からも共通で参照する（Challenge専用の複雑な状態管理を増やさない）。
   */
  const handleChallengeSent = useCallback((challenge: ChallengeRecord) => {
    // Ver.6 Phase 5.3（送った挑戦状一覧）: Challenge情報本体は保存せず、IDだけを記録する。
    addCreatedChallengeId(challenge.id)
    setActiveChallenge(challenge)
    setScreen('challengeSent')
  }, [])

  const handleChallengeAccept = useCallback((challenge: ChallengeRecord) => {
    trackChallengePlayed(challenge.mode)
    setActiveChallenge(challenge)
    setChallengePlayKey((k) => k + 1)
    setScreen('challengePlaying')
  }, [])

  const handleChallengeRetry = useCallback(() => {
    if (!activeChallenge) return
    trackChallengePlayed(activeChallenge.mode)
    setChallengePlayKey((k) => k + 1)
    setScreen('challengePlaying')
  }, [activeChallenge])

  const handleChallengeFinish = useCallback((finalResult: FinalResultV4) => {
    setChallengeResult(finalResult)
    setScreen('challengeResult')
  }, [])

  /** Ver.6 Phase 8（ENDLESS Challenge）: mode==='endless'専用の薄い完了パス（FinalResultV4を経由しない）。 */
  const handleChallengeFinishEndless = useCallback((streak: number) => {
    setChallengeEndlessStreak(streak)
    setScreen('challengeResult')
  }, [])

  const openChallengeHistory = useCallback((challenge: ChallengeRecord) => {
    setActiveChallenge(challenge)
    setScreen('challengeHistory')
  }, [])

  /**
   * Ver.6 Phase 5: Profile/Achievement/Rankingはゲームプレイとは独立した単純な画面遷移
   * （バックスタックを持たない、既存のEndlessSelectScreen等と同じフラットな遷移モデル）。
   * どの入口（TitleScreenのサブ導線／ProfileScreenのボタン）から来ても「戻る」は
   * 常にホームへ戻る。ProfileEditScreenだけはProfileの一段下なので、保存/キャンセル
   * いずれも'profile'へ戻す。
   */
  const openProfile = useCallback(() => setScreen('profile'), [])
  const openProfileEdit = useCallback(() => setScreen('profileEdit'), [])

  /**
   * 次フェーズ（item 17/18）: Achievement/Ranking/作成したChallenge/参加したChallengeの
   * 4画面は、Profileからも・Home（title画面のサブ導線）からも開ける。開いた瞬間の
   * 現在screenから「どこから来たか」をsubScreenOriginへ記録し、各画面の「戻る」は
   * 常にHomeへ固定せず、記録した方へ戻す（ブラウザのhistoryには一切依存しない、
   * 既存のscreen状態モデル内だけで解決する——ユーザー指示どおり）。
   */
  const [subScreenOrigin, setSubScreenOrigin] = useState<SubScreenOrigin>('title')
  const openAchievements = useCallback(() => {
    setSubScreenOrigin(resolveSubScreenOrigin(screen))
    setScreen('achievements')
  }, [screen])
  const openRanking = useCallback(() => {
    setSubScreenOrigin(resolveSubScreenOrigin(screen))
    setScreen('ranking')
  }, [screen])
  const openSentChallenges = useCallback(() => {
    setSubScreenOrigin(resolveSubScreenOrigin(screen))
    setScreen('challengeSentList')
  }, [screen])
  const openParticipatedChallenges = useCallback(() => {
    setSubScreenOrigin(resolveSubScreenOrigin(screen))
    setScreen('challengeParticipatedList')
  }, [screen])
  const subScreenBackTarget = getSubScreenBackTarget(subScreenOrigin)
  const backFromSubScreen = useCallback(() => setScreen(subScreenBackTarget.screen), [subScreenBackTarget.screen])

  /**
   * Ver.6 Phase 6（1対1リアルタイム対戦）: BATTLE（世界対戦・フレンド対戦）の画面遷移。
   * 他のモードと同じフラットな遷移モデル。マッチング成立／ルーム合流が決まった時点で
   * battleMatchを確定し、以後はBattleMatchScreenが1つのWebSocket接続のまま
   * countdown→playing→resultを内部で遷移する。
   */
  const openBattleHome = useCallback(() => setScreen('battleHome'), [])
  const openWorldMatching = useCallback(() => setScreen('battleWorldMatching'), [])
  const openFriendBattle = useCallback(() => setScreen('battleFriend'), [])

  const handleWorldMatchFound = useCallback((matchId: string, opponent: BattleOpponentProfile) => {
    setBattleMatch({ matchId, mode: 'world', roomCode: null, opponent })
    setScreen('battleMatch')
  }, [])

  const handleEnterFriendRoom = useCallback((roomCode: string) => {
    setBattleMatch({ matchId: roomCode, mode: 'friend', roomCode, opponent: null })
    setScreen('battleMatch')
  }, [])

  const exitBattle = useCallback(() => {
    maybeGateWithInterstitial(() => {
      setBattleMatch(null)
      setScreen('title')
    })
  }, [maybeGateWithInterstitial])

  /**
   * 次フェーズ（DOPA PASS基盤ラウンド）: Profile/PRIVATE ROOM作成ゲート等、複数の入口から
   * 開けるpaywall画面。sourceは呼び出し元（analytics.ts PassPaywallSource）ごとに変える。
   */
  const [passPaywallSource, setPassPaywallSource] = useState<PassPaywallSource>('profile')
  // 次フェーズ（item 18 PRIVATE ROOM create-room paywall gate）: paywallは複数の画面
  // （Profile／PrivateRoomHomeScreenの「ルームを作る」）から開ける。subScreenOrigin
  // （profile/title二択）では戻り先がprivateRoomHomeにならないため、実際に開いた時の
  // screenそのものを戻り先として保持する。
  const [passPaywallReturnScreen, setPassPaywallReturnScreen] = useState<ScreenName>('title')
  const openPassPaywall = useCallback(
    (source: PassPaywallSource) => {
      setPassPaywallSource(source)
      setPassPaywallReturnScreen(screen)
      setScreen('passPaywall')
    },
    [screen],
  )
  const openPassAnalytics = useCallback(() => {
    setSubScreenOrigin(resolveSubScreenOrigin(screen))
    setScreen('passAnalytics')
  }, [screen])
  const handlePassPurchased = useCallback(() => {
    setScreen(passPaywallReturnScreen)
  }, [passPaywallReturnScreen])

  /**
   * 次フェーズ（DOPA PASS基盤ラウンド、item 15 PRIVATE ROOM）: PRIVATE ROOMの画面遷移。
   * 既存のbattleMatch（World/Friend Battle専用）とは完全に分離する——PRIVATE ROOM経由の
   * NORMAL対戦も戻り先がprivateRoomLobbyになる点が既存と異なるため、別の状態として持つ。
   */
  const openPrivateRoomHome = useCallback(() => setScreen('privateRoomHome'), [])

  const enterPrivateRoomLobby = useCallback((roomCode: string) => {
    setPrivateRoomCode(roomCode)
    setPrivateRoomMatch(null)
    setScreen('privateRoomLobby')
  }, [])

  const handlePrivateRoomEnterMatch = useCallback(
    (args: { matchId: string; battleType: BattleFormat; endlessDifficulty: EndlessDifficulty | null; opponentProfile: BattleOpponentProfile }) => {
      setPrivateRoomMatch(args)
      setScreen(args.battleType === 'endless' ? 'privateEndlessMatch' : 'privateRoomMatch')
    },
    [],
  )

  /**
   * 次フェーズ（item 15 PRIVATE ROOM、実機/E2Eで発見した競合の修正）: 試合から戻った直後、
   * PrivateRoomLobbyScreen（毎回アンマウント→再マウントする）のローカルなuseRefだけでは
   * 「この試合にはもう入らない」という記憶が再マウント時に失われる。BattleRoom DO→
   * PrivateRoom DOへの通知（notifyPrivateRoomIfAny）がサーバー権威として先に完了する設計へ
   * 既に修正済みだが、Durable Objectのローカル開発環境（Miniflare）では同一DOへの複数
   * リクエストの厳密な直列化がPlaywright E2Eで再現できる形では保証されないことを確認した
   * （本番Cloudflare環境のinput gate機構でも絶対に発生しないとは限らないため、クライアント
   * 側でも二重の安全網を持たせる）。App.tsx（screenという唯一の永続的な状態を持つ場所）側で
   * 「既に退出した試合ID」を記憶し、ロビーがどれだけ速く再接続してstale気味のactiveMatchを
   * 受け取っても、同じmatchIdへは二度と入らないことを保証する。
   */
  const exitedPrivateMatchIdsRef = useRef<Set<string>>(new Set())
  const isPrivateMatchAlreadyHandled = useCallback((matchId: string) => exitedPrivateMatchIdsRef.current.has(matchId), [])

  // item: PRIVATE ROOMはChallenge・ENDLESS Challengeと同様、強制インタースティシャルの
  // 対象から完全に除外する（ユーザー指示）——exitBattleのようなmaybeGateWithInterstitial
  // ラップを一切行わない。
  const exitPrivateRoomMatch = useCallback(() => {
    setPrivateRoomMatch((prev) => {
      if (prev) exitedPrivateMatchIdsRef.current.add(prev.matchId)
      return null
    })
    setScreen('privateRoomLobby')
  }, [])

  const leavePrivateRoom = useCallback(() => {
    setPrivateRoomCode(null)
    setPrivateRoomMatch(null)
    setScreen('battleHome')
  }, [])

  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-[430px] overflow-hidden bg-[#0b0620]">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="bg-blob absolute -left-24 -top-24 h-72 w-72 rounded-full bg-fuchsia-600/20 blur-3xl" />
        <div className="bg-blob absolute -right-20 top-1/3 h-72 w-72 rounded-full bg-purple-600/20 blur-3xl" />
      </div>

      {showOverdrivePreview ? (
        <OverdrivePreviewScreen />
      ) : showFinalTrialPreview ? (
        <FinalTrialPreviewScreen mode="finaltrial" />
      ) : showFinalQuestionPreview ? (
        <FinalTrialPreviewScreen mode="finalquestion" />
      ) : showClear200Preview ? (
        <FinalTrialPreviewScreen mode="clear200" />
      ) : showChallenge500QaPreview ? (
        <Challenge500QaPreviewScreen />
      ) : showEndlessPreview ? (
        <EndlessPreviewScreen />
      ) : (
        <>
          {screen === 'title' && (
            <>
              <TitleScreen
                onStart={() => startPlay('title')}
                onStartEndless={openEndlessSelect}
                onStartBattle={openBattleHome}
                onOpenProfile={openProfile}
                onOpenAchievements={openAchievements}
                onOpenRanking={openRanking}
              />
              {migrationUnlocked.length > 0 && (
                <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex flex-col items-center px-6">
                  <div className="pointer-events-auto">
                    <AchievementUnlockBanner newlyUnlocked={migrationUnlocked} />
                  </div>
                </div>
              )}
            </>
          )}
          {screen === 'playing' && <PlayScreen key={playKey} onFinish={handleFinish} onQuit={quitToHome} />}
          {screen === 'result' && result && (
            <ResultScreen result={result} onRetry={() => maybeGateWithInterstitial(() => startPlay('retry'))} onChallengeSent={handleChallengeSent} />
          )}
          {screen === 'endlessSelect' && <EndlessSelectScreen onSelect={startEndless} onBack={quitToHome} />}
          {screen === 'endlessPlaying' && (
            <EndlessPlayScreen key={endlessPlayKey} difficulty={endlessDifficulty} onFinish={handleEndlessFinish} onQuit={quitToHome} />
          )}
          {screen === 'endlessResult' && endlessResult && (
            <EndlessResultScreen
              difficulty={endlessDifficulty}
              score={endlessResult.score}
              best={endlessResult.best}
              isNewBest={endlessResult.isNewBest}
              newlyUnlockedAchievements={endlessResult.newlyUnlockedAchievements}
              recordedProblemSet={endlessResult.recordedProblemSet}
              onChallengeSent={handleChallengeSent}
              onRetry={() => maybeGateWithInterstitial(() => startEndless(endlessDifficulty))}
              onChangeDifficulty={() => maybeGateWithInterstitial(() => setScreen('endlessSelect'))}
              onHome={() => maybeGateWithInterstitial(quitToHome)}
            />
          )}
          {screen === 'profile' && (
            <ProfileScreen
              onBack={quitToHome}
              onEdit={openProfileEdit}
              onAchievements={openAchievements}
              onRanking={openRanking}
              onSentChallenges={openSentChallenges}
              onParticipatedChallenges={openParticipatedChallenges}
              onOpenPassAnalytics={openPassAnalytics}
              onOpenPassPaywall={() => openPassPaywall('profile')}
            />
          )}
          {screen === 'profileEdit' && <ProfileEditScreen onDone={openProfile} />}
          {screen === 'achievements' && <AchievementScreen onBack={backFromSubScreen} backLabel={subScreenBackTarget.label} />}
          {screen === 'ranking' && <RankingScreen onBack={backFromSubScreen} backLabel={subScreenBackTarget.label} />}
          {screen === 'passAnalytics' && <PassAnalyticsScreen onBack={backFromSubScreen} />}
          {screen === 'passPaywall' && (
            <PassPaywallScreen source={passPaywallSource} onBack={() => setScreen(passPaywallReturnScreen)} onPurchased={handlePassPurchased} />
          )}
          {screen === 'challengeReceive' && challengeId && (
            <ChallengeReceiveScreen
              challengeId={challengeId}
              onAccept={handleChallengeAccept}
              onHome={quitToHome}
              onViewHistory={openChallengeHistory}
            />
          )}
          {screen === 'challengeSent' && activeChallenge && <ChallengeSentScreen challenge={activeChallenge} onDone={quitToHome} />}
          {screen === 'challengePlaying' && activeChallenge && (
            <ChallengePlayScreen
              key={challengePlayKey}
              challenge={activeChallenge}
              onFinish={handleChallengeFinish}
              onFinishEndless={handleChallengeFinishEndless}
              onQuit={quitToHome}
            />
          )}
          {screen === 'challengeResult' && activeChallenge && (challengeResult || challengeEndlessStreak !== null) && (
            <ChallengeResultScreen
              challenge={activeChallenge}
              myResult={challengeResult ?? undefined}
              myEndlessStreak={challengeEndlessStreak ?? undefined}
              onRetry={handleChallengeRetry}
              onHome={quitToHome}
              onViewHistory={() => openChallengeHistory(activeChallenge)}
            />
          )}
          {screen === 'challengeHistory' && activeChallenge && (
            <ChallengeHistoryScreen challenge={activeChallenge} onBack={quitToHome} />
          )}
          {screen === 'challengeSentList' && (
            <SentChallengesScreen onBack={backFromSubScreen} backLabel={subScreenBackTarget.label} onOpenHistory={openChallengeHistory} />
          )}
          {screen === 'challengeParticipatedList' && (
            <ParticipatedChallengesScreen onBack={backFromSubScreen} backLabel={subScreenBackTarget.label} onOpenHistory={openChallengeHistory} />
          )}
          {screen === 'battleHome' && (
            <BattleHomeScreen
              onBack={quitToHome}
              onWorldBattle={openWorldMatching}
              onFriendBattle={openFriendBattle}
              onPrivateRoom={openPrivateRoomHome}
            />
          )}
          {screen === 'battleWorldMatching' && (
            <WorldMatchingScreen
              playerId={getOrCreatePlayerId()}
              profile={toBattleProfile(getProfile())}
              onBack={openBattleHome}
              onMatchFound={handleWorldMatchFound}
            />
          )}
          {screen === 'battleFriend' && (
            <FriendBattleScreen onBack={openBattleHome} onEnterRoom={handleEnterFriendRoom} initialRoomCode={initialBattleRoomCode} />
          )}
          {screen === 'battleMatch' && battleMatch && (
            <BattleMatchScreen
              matchId={battleMatch.matchId}
              mode={battleMatch.mode}
              roomCode={battleMatch.roomCode}
              playerId={getOrCreatePlayerId()}
              myProfile={toBattleProfile(getProfile())}
              initialOpponent={battleMatch.opponent}
              onExit={exitBattle}
            />
          )}
          {screen === 'privateRoomHome' && (
            <PrivateRoomHomeScreen
              onBack={openBattleHome}
              onEnterLobby={enterPrivateRoomLobby}
              onRequirePass={() => openPassPaywall('private_room_create')}
              hasPass={qaLocalEntitlementRepository.hasEntitlement('PRIVATE_ROOM_CREATE')}
              playerId={getOrCreatePlayerId()}
              myProfile={toBattleProfile(getProfile())}
              initialRoomCode={initialPrivateRoomCode}
            />
          )}
          {screen === 'privateRoomLobby' && privateRoomCode && (
            <PrivateRoomLobbyScreen
              roomCode={privateRoomCode}
              playerId={getOrCreatePlayerId()}
              myProfile={toBattleProfile(getProfile())}
              onLeave={leavePrivateRoom}
              onEnterMatch={handlePrivateRoomEnterMatch}
              isMatchAlreadyHandled={isPrivateMatchAlreadyHandled}
            />
          )}
          {screen === 'privateRoomMatch' && privateRoomMatch && (
            <BattleMatchScreen
              matchId={privateRoomMatch.matchId}
              mode="friend"
              roomCode={null}
              playerId={getOrCreatePlayerId()}
              myProfile={toBattleProfile(getProfile())}
              initialOpponent={privateRoomMatch.opponentProfile}
              onExit={exitPrivateRoomMatch}
            />
          )}
          {screen === 'privateEndlessMatch' && privateRoomMatch && privateRoomMatch.endlessDifficulty && (
            <PrivateEndlessMatchScreen
              matchId={privateRoomMatch.matchId}
              endlessDifficulty={privateRoomMatch.endlessDifficulty}
              playerId={getOrCreatePlayerId()}
              myProfile={toBattleProfile(getProfile())}
              initialOpponent={privateRoomMatch.opponentProfile}
              onExit={exitPrivateRoomMatch}
            />
          )}
        </>
      )}
      {heartEmptyEtaMs !== null && <HeartEmptyModal initialEtaMs={heartEmptyEtaMs} onClose={() => setHeartEmptyEtaMs(null)} />}
      {pendingAdAction && (
        <MockInterstitialAd
          onClose={() => {
            const action = pendingAdAction
            setPendingAdAction(null)
            action()
          }}
        />
      )}
    </div>
  )
}
