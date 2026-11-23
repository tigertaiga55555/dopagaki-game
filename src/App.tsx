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
import { FriendProfileScreen } from './screens/FriendProfileScreen'
import { FriendsHomeScreen } from './screens/FriendsHomeScreen'
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
import { PrivateEndlessMatchScreen } from './screens/battle/PrivateEndlessMatchScreen'
import { PrivateRoomHomeScreen } from './screens/battle/PrivateRoomHomeScreen'
import { PrivateRoomLobbyScreen } from './screens/battle/PrivateRoomLobbyScreen'
import { WorldMatchingScreen } from './screens/battle/WorldMatchingScreen'
import { TitleScreen } from './screens/TitleScreen'
import { addCreatedChallengeId } from './challenge/createdChallengesStorage'
import { extractChallengeIdFromLocation } from './challenge/url'
import { createPrivateRoom } from './battle/privateRoomClient'
import { extractPrivateRoomCodeFromLocation } from './battle/privateRoomUrl'
import type { BattleFormat } from './battle/types'
import { connectToPresenceHub, type PresenceSocket } from './presence/presenceClient'
import type { PresenceSnapshot } from './presence/presenceTypes'
import { listIncomingFriendRequests } from './friends/friendsClient'
import type { PublicProfileSnapshot } from './friends/types'
import type { RoomClosedReason } from './battle/privateRoomTypes'
import { trackChallengePlayed, trackGameStart, trackReplayStart, type PassPaywallSource } from './utils/analytics'
import { unlockAudio } from './utils/audioContext'
import { runMigrationsOnce } from './utils/migrations'
import { getOrCreatePlayerId, getProfile } from './utils/profileStorage'
import { buildPublicProfileSnapshot, syncPublicProfile } from './utils/publicProfileSync'
import { sfx } from './utils/sound'
import { checkAndConsumeInterstitial, recordEligiblePlayCompleted } from './utils/adPolicyStorage'
import { qaLocalEntitlementRepository } from './payment/entitlementRepository'
import { localHeartRepository } from './utils/heartRepository'
import type { BattleMode, BattleOpponentProfile } from './battle/types'
import type { ChallengeRecord } from './challenge/types'
import type { AchievementId, EndlessDifficulty, FinalResultV4, ScreenName } from './types'
import { AchievementUnlockBanner } from './components/AchievementUnlockBanner'
import { HeartEmptyModal } from './components/HeartEmptyModal'
import { MockInterstitialAd } from './components/MockInterstitialAd'
import { RoomInviteBanner } from './components/RoomInviteBanner'

function toBattleProfile(profile: ReturnType<typeof getProfile>): BattleOpponentProfile {
  return { nickname: profile.nickname, avatar: profile.avatar, equippedTitleId: profile.equippedTitleId }
}

/**
 * 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 32-34）: 「× やめる」の既存パターンを保つ
 * プレイ中の画面（確認モーダル付き）。これらの画面にはNavBar（← 戻る／⌂ ホーム）を一切
 * 出さない——set_state送信（プレゼンス）の判定にもこの一覧を使う。
 */
const PLAYING_SCREENS: ScreenName[] = ['playing', 'endlessPlaying', 'challengePlaying', 'battleMatch', 'privateRoomMatch', 'privateEndlessMatch']

/**
 * 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 32-34）: Challenge受信・PRIVATE ROOM参加
 * （URL/ルームコード）等のdeep link入口は、[Home, その画面]という浅いスタックで始める
 * （空/壊れたbackターゲットにしない、というユーザー指示）。
 */
function initialNavStack(): ScreenName[] {
  if (extractChallengeIdFromLocation()) return ['title', 'challengeReceive']
  if (extractPrivateRoomCodeFromLocation()) return ['title', 'privateRoomHome']
  return ['title']
}

export default function App() {
  /**
   * 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 32-34）: ブラウザのhistory.back()に一切
   * 依存しない、本物のナビゲーションスタック（ユーザー指示：history.back()は外部ページや
   * stale状態のPreview URLへ飛ぶ不安定さがあるため禁止）。
   *
   * - pushScreen: メニュー間の「次の画面を開く」操作（戻れば必ずここに戻ってくる）。
   * - replaceScreen: 同じフロー内の次の段階への遷移（例: プレイ中→結果、結果→リトライで
   *   再度プレイ中）。戻るボタンを持たない画面同士の遷移なのでスタックの深さを無駄に
   *   増やさない。
   * - popScreen: 「← 戻る」が常に呼ぶ、1つだけ戻る操作。
   * - goHome: 「⌂ ホーム」が呼ぶ、スタック全クリア。
   *
   * 旧subScreenNavigation.ts（「開いた場所を記憶して戻り先を変える」という2ラウンド前の
   * 一点物の解決策）は、この本物のスタック導入によって完全に不要になったため削除した
   * ——Achievement/Ranking/作成/参加したChallengeのどれも、TitleからでもProfileからでも
   * 開けて、「戻る」は開いた場所へ自動的に戻る（スタックの自然な性質であり、画面ごとに
   * 個別の記憶ロジックを持つ必要がない）。
   */
  const [navStack, setNavStack] = useState<ScreenName[]>(initialNavStack)
  const screen = navStack[navStack.length - 1]
  const pushScreen = useCallback((s: ScreenName) => setNavStack((prev) => [...prev, s]), [])
  const replaceScreen = useCallback((s: ScreenName) => setNavStack((prev) => [...prev.slice(0, -1), s]), [])
  const popScreen = useCallback(() => setNavStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev)), [])
  const goHome = useCallback(() => setNavStack(['title']), [])

  const [result, setResult] = useState<FinalResultV4 | null>(null)
  const [playKey, setPlayKey] = useState(0)
  // Ver.6 Phase 5.2: Challenge専用の状態。通常ゲーム・Endlessとは完全に独立させる。
  const [challengeId] = useState(() => extractChallengeIdFromLocation())
  const [activeChallenge, setActiveChallenge] = useState<ChallengeRecord | null>(null)
  const [challengeResult, setChallengeResult] = useState<FinalResultV4 | null>(null)
  /** Ver.6 Phase 8（ENDLESS Challenge）: mode==='endless'の挑戦プレイ結果（STREAK数のみ、FinalResultV4は使わない）。 */
  const [challengeEndlessStreak, setChallengeEndlessStreak] = useState<number | null>(null)
  const [challengePlayKey, setChallengePlayKey] = useState(0)
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
  // 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 27）: フレンドの公開プロフィール画面で、
  // どのplayerIdを表示するか。
  const [friendProfilePlayerId, setFriendProfilePlayerId] = useState<string | null>(null)
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
   * 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 27）: 同じタイミングで、自分の公開
   * プロフィール（ニックネーム・アバター・PASS所有・各種BEST）をWorkerへ1回アップロード
   * する（syncPublicProfile）——フレンドがこちらのプロフィールを見られるようにするための
   * 最小限の同期ポイントの1つ（他はProfileEditScreen保存時・DOPA PASS購入直後）。
   */
  const [migrationUnlocked, setMigrationUnlocked] = useState<AchievementId[]>([])
  useEffect(() => {
    getOrCreatePlayerId()
    setMigrationUnlocked(runMigrationsOnce())
    syncPublicProfile()
  }, [])

  /**
   * 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 28/31）: プレゼンス（ONLINE/PLAYING）＋
   * PRIVATE ROOM招待の受信チャネル。アプリが開いている間ずっと1本だけ接続を張る
   * （画面遷移のたびに繋ぎ直さない）——どの画面にいても招待を受け取れるようにするため。
   */
  const presenceSocketRef = useRef<PresenceSocket | null>(null)
  const [presenceSnapshot, setPresenceSnapshot] = useState<PresenceSnapshot>({})
  const [incomingInvite, setIncomingInvite] = useState<{ fromProfile: PublicProfileSnapshot; roomCode: string } | null>(null)

  useEffect(() => {
    const playerId = getOrCreatePlayerId()
    const socket = connectToPresenceHub(
      playerId,
      (msg) => {
        if (msg.type === 'presence_snapshot') {
          setPresenceSnapshot((prev) => ({ ...prev, ...msg.snapshot }))
        } else if (msg.type === 'room_invite_received') {
          setIncomingInvite({ fromProfile: msg.fromProfile, roomCode: msg.roomCode })
        }
      },
      () => {},
    )
    presenceSocketRef.current = socket
    return () => socket.close()
  }, [])

  // プレイ中の画面に入った/出た瞬間だけ、プレゼンス状態をPLAYING/ONLINEへ切り替える。
  useEffect(() => {
    presenceSocketRef.current?.send({ v: 1, type: 'set_state', state: PLAYING_SCREENS.includes(screen) ? 'playing' : 'online' })
  }, [screen])

  const subscribeFriendPresence = useCallback((playerIds: string[]) => {
    presenceSocketRef.current?.send({ v: 1, type: 'subscribe', playerIds })
  }, [])

  /**
   * 次フェーズ（FRIENDS/TABLE/ナビ追加調整ラウンド、item 49）: Home左上のFRIENDS入口の
   * 未読バッジ＝届いている友達申請数＋（表示中のPRIVATE ROOM招待バナーがあれば+1）。
   * ポーリングループは作らず、起動時＋Homeへ戻るたびの最小限の再取得だけにする。
   */
  const [pendingFriendRequestCount, setPendingFriendRequestCount] = useState(0)
  const refreshPendingFriendRequests = useCallback(() => {
    listIncomingFriendRequests(getOrCreatePlayerId()).then((reqs) => setPendingFriendRequestCount(reqs.length))
  }, [])
  useEffect(() => {
    refreshPendingFriendRequests()
  }, [refreshPendingFriendRequests])
  useEffect(() => {
    if (screen === 'title') refreshPendingFriendRequests()
  }, [screen, refreshPendingFriendRequests])
  const friendsUnreadCount = pendingFriendRequestCount + (incomingInvite ? 1 : 0)

  /**
   * Ver.6 Phase 5.0追加: GA4のgame_start（常に）とreplay_start（結果画面からのリトライ時のみ）を
   * ここで送信する。sourceはこの関数の呼び出し元（タイトルのSTART / 結果画面のリトライ）を
   * 区別するためだけの引数で、ゲームの開始処理自体（unlockAudio/sfx/画面遷移）は
   * sourceに関わらず完全に同一。
   */
  /**
   * 次フェーズ（DOPA PASS基盤ラウンド、item 12）: DOPA RUSH/ENDLESSの開始直前にだけ所持数を
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

  const startPlay = useCallback(
    (source: 'title' | 'retry') => {
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
      if (source === 'retry') replaceScreen('playing')
      else pushScreen('playing')
    },
    [pushScreen, replaceScreen],
  )

  const handleFinish = useCallback(
    (result: FinalResultV4) => {
      // 次フェーズ（DOPA PASS基盤ラウンド）: DOPA RUSH/ENDLESS/World Battle合算の
      // 強制インタースティシャル対象カウンター（Challenge・ENDLESS Challenge・
      // PRIVATE ROOMでは呼ばない）。
      recordEligiblePlayCompleted()
      setResult(result)
      replaceScreen('result')
    },
    [replaceScreen],
  )

  /**
   * Ver.6準備: 画面右上の「やめる」ボタン用。onFinishを一切経由せずHomeへ戻るだけなので、
   * 結果計算（computeFinalResult等）もスコア保存（incrementPlayCount/updateBestPercent、
   * いずれもresultEngineV4.ts内でonFinish経由でのみ呼ばれる）も一切発生しない。
   * PlayScreen（useRushGame）・FinalTrialScreen（useFinalTrial）はこのタイミングで
   * アンマウントされ、両hookが既に持つuseEffectクリーンアップ（RAFキャンセル・タイマー
   * 全クリア・BGM停止）がそのまま働くため、追加の後片付けは不要。
   *
   * 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 32-34）: 「× やめる」は常にスタック全体を
   * クリアしてHomeへ直接ジャンプする（goHome、ユーザー指示どおり既存の×やめるパターンは
   * 変更しない——ただし内部実装はsetScreen('title')からgoHome()へ揃えた）。
   */
  const quitToHome = useCallback(() => {
    goHome()
  }, [goHome])

  /**
   * Ver.6 Phase 4: ホーム画面の「ENDLESS」ボタン用。通常ゲームのstartPlayとは別経路
   * （unlockAudio/sfx.startPressは共有するが、trackGameStart/trackReplayStartは
   * Endless専用のtrackEndlessStart（useEndlessGame.ts側）と別イベントのため送らない）。
   */
  const openEndlessSelect = useCallback(() => {
    unlockAudio()
    sfx.startPress()
    pushScreen('endlessSelect')
  }, [pushScreen])

  const startEndless = useCallback(
    (difficulty: EndlessDifficulty) => {
      if (!qaLocalEntitlementRepository.hasEntitlement('UNLIMITED_HEART') && localHeartRepository.getHeartCount() <= 0) {
        setHeartEmptyEtaMs(localHeartRepository.getNextRecoveryEtaMs() ?? 0)
        return
      }
      setEndlessDifficulty(difficulty)
      setEndlessPlayKey((k) => k + 1)
      replaceScreen('endlessPlaying')
    },
    [replaceScreen],
  )

  const handleEndlessFinish = useCallback(
    (payload: EndlessFinishPayload) => {
      recordEligiblePlayCompleted()
      setEndlessResult(payload)
      replaceScreen('endlessResult')
    },
    [replaceScreen],
  )

  /**
   * Ver.6 Phase 5.2（Challenge機能完成）: Challengeの一連の画面遷移。
   * activeChallengeという単一の状態をsent/receive/play/result/historyのどの画面からも
   * 共通で参照する（Challenge専用の複雑な状態管理を増やさない）。
   */
  const handleChallengeSent = useCallback(
    (challenge: ChallengeRecord) => {
      // Ver.6 Phase 5.3（送った挑戦状一覧）: Challenge情報本体は保存せず、IDだけを記録する。
      addCreatedChallengeId(challenge.id)
      setActiveChallenge(challenge)
      replaceScreen('challengeSent')
    },
    [replaceScreen],
  )

  const handleChallengeAccept = useCallback(
    (challenge: ChallengeRecord) => {
      trackChallengePlayed(challenge.mode)
      setActiveChallenge(challenge)
      setChallengePlayKey((k) => k + 1)
      replaceScreen('challengePlaying')
    },
    [replaceScreen],
  )

  const handleChallengeRetry = useCallback(() => {
    if (!activeChallenge) return
    trackChallengePlayed(activeChallenge.mode)
    setChallengePlayKey((k) => k + 1)
    replaceScreen('challengePlaying')
  }, [activeChallenge, replaceScreen])

  const handleChallengeFinish = useCallback(
    (finalResult: FinalResultV4) => {
      setChallengeResult(finalResult)
      replaceScreen('challengeResult')
    },
    [replaceScreen],
  )

  /** Ver.6 Phase 8（ENDLESS Challenge）: mode==='endless'専用の薄い完了パス（FinalResultV4を経由しない）。 */
  const handleChallengeFinishEndless = useCallback(
    (streak: number) => {
      setChallengeEndlessStreak(streak)
      replaceScreen('challengeResult')
    },
    [replaceScreen],
  )

  const openChallengeHistory = useCallback(
    (challenge: ChallengeRecord) => {
      setActiveChallenge(challenge)
      pushScreen('challengeHistory')
    },
    [pushScreen],
  )

  /**
   * Ver.6 Phase 5: Profile/Achievement/Rankingはゲームプレイとは独立した単純な画面遷移。
   * 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 32-34）: Title・Profileのどちらから開いても
   * 本物のスタックへpushするだけで、「戻る」は自動的に開いた場所へ戻る
   * （旧subScreenOrigin/getSubScreenBackTargetは不要になったため削除）。
   */
  const openProfile = useCallback(() => pushScreen('profile'), [pushScreen])
  const openProfileEdit = useCallback(() => pushScreen('profileEdit'), [pushScreen])
  const handleProfileEditDone = useCallback(() => {
    syncPublicProfile()
    popScreen()
  }, [popScreen])
  const openAchievements = useCallback(() => pushScreen('achievements'), [pushScreen])
  const openRanking = useCallback(() => pushScreen('ranking'), [pushScreen])
  const openSentChallenges = useCallback(() => pushScreen('challengeSentList'), [pushScreen])
  const openParticipatedChallenges = useCallback(() => pushScreen('challengeParticipatedList'), [pushScreen])

  /**
   * 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 27）: フレンド一覧・フレンドの公開プロフィール。
   */
  const openFriends = useCallback(() => pushScreen('friendsHome'), [pushScreen])
  const openFriendProfile = useCallback(
    (targetPlayerId: string) => {
      setFriendProfilePlayerId(targetPlayerId)
      pushScreen('friendProfile')
    },
    [pushScreen],
  )

  /**
   * Ver.6 Phase 6（1対1リアルタイム対戦）: BATTLE（世界対戦・PRIVATE ROOM）の画面遷移。
   * 他のモードと同じフラットな遷移モデル。マッチング成立／ルーム合流が決まった時点で
   * battleMatchを確定し、以後はBattleMatchScreenが1つのWebSocket接続のまま
   * countdown→playing→resultを内部で遷移する。
   *
   * 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 25/26）: スタンドアロンのフレンド対戦
   * （URL・ルームコードだけで誰でも無料に始められる導線）はここから廃止した
   * ——友達との対戦はPRIVATE ROOMだけに一本化する。BattleMode型の'friend'・
   * 既存のBattleRoom DO・battleRoomEngine.ts・/api/battles/rooms系ルートは一切削除せず、
   * PRIVATE ROOMのNORMAL対戦が既にmode:'friend'として引き続き再利用する。
   */
  const openBattleHome = useCallback(() => pushScreen('battleHome'), [pushScreen])
  const openWorldMatching = useCallback(() => pushScreen('battleWorldMatching'), [pushScreen])

  const handleWorldMatchFound = useCallback(
    (matchId: string, opponent: BattleOpponentProfile) => {
      setBattleMatch({ matchId, mode: 'world', roomCode: null, opponent })
      replaceScreen('battleMatch')
    },
    [replaceScreen],
  )

  const exitBattle = useCallback(() => {
    maybeGateWithInterstitial(() => {
      setBattleMatch(null)
      goHome()
    })
  }, [maybeGateWithInterstitial, goHome])

  /**
   * 次フェーズ（DOPA PASS基盤ラウンド）: Profile/PRIVATE ROOM作成ゲート/FRIENDSの招待等、
   * 複数の入口から開けるpaywall画面。sourceは呼び出し元（analytics.ts PassPaywallSource）
   * ごとに変える。
   *
   * 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 32-34）: 本物のスタックへpushするだけで、
   * 「戻る」も「購入完了」もpopScreen()で開いた場所へ自動的に戻る——旧
   * passPaywallReturnScreen（「開いた時のscreenを覚えておく」専用state）は、スタックが
   * 同じことを構造的に保証するため不要になった。
   */
  const [passPaywallSource, setPassPaywallSource] = useState<PassPaywallSource>('profile')
  const openPassPaywall = useCallback(
    (source: PassPaywallSource) => {
      setPassPaywallSource(source)
      pushScreen('passPaywall')
    },
    [pushScreen],
  )
  const openPassAnalytics = useCallback(() => pushScreen('passAnalytics'), [pushScreen])
  const handlePassPurchased = useCallback(() => {
    // 購入直後にPASS所有フラグを反映した公開プロフィールを同期する（friends一覧の
    // DOPA PASSバッジ表示にも使われるため）。
    syncPublicProfile()
    popScreen()
  }, [popScreen])

  /**
   * 次フェーズ（DOPA PASS基盤ラウンド、item 15 PRIVATE ROOM）: PRIVATE ROOMの画面遷移。
   * 既存のbattleMatch（World Battle専用）とは完全に分離する——PRIVATE ROOM経由の
   * NORMAL対戦も戻り先がprivateRoomLobbyになる点が既存と異なるため、別の状態として持つ。
   */
  const openPrivateRoomHome = useCallback(() => pushScreen('privateRoomHome'), [pushScreen])

  const enterPrivateRoomLobby = useCallback(
    (roomCode: string) => {
      setPrivateRoomCode(roomCode)
      setPrivateRoomMatch(null)
      pushScreen('privateRoomLobby')
    },
    [pushScreen],
  )

  /**
   * 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 31）: フレンド一覧の「ルームに招待」
   * （既存のアクティブルームがある場合）。ナビゲーションは一切変えない——招待する側は
   * FriendsHomeScreenに留まる。
   */
  const inviteToExistingRoom = useCallback((toPlayerId: string, roomCode: string) => {
    presenceSocketRef.current?.send({
      v: 1,
      type: 'send_room_invite',
      toPlayerId,
      fromProfile: buildPublicProfileSnapshot(),
      roomCode,
    })
  }, [])

  /** 次フェーズ（item 31）: 「ルームを作成して招待」（まだアクティブルームが無い場合）。作成した自分もそのロビーへ入る。 */
  const createRoomAndInvite = useCallback(
    async (toPlayerId: string) => {
      const playerId = getOrCreatePlayerId()
      const myProfile = toBattleProfile(getProfile())
      const res = await createPrivateRoom(playerId, myProfile)
      if (!res) return
      presenceSocketRef.current?.send({
        v: 1,
        type: 'send_room_invite',
        toPlayerId,
        fromProfile: buildPublicProfileSnapshot(),
        roomCode: res.roomCode,
      })
      enterPrivateRoomLobby(res.roomCode)
    },
    [enterPrivateRoomLobby],
  )

  /** 次フェーズ（item 31）: 招待バナーの[参加]。参加は誰でも無料のため、paywallは一切経由しない。 */
  const acceptRoomInvite = useCallback(() => {
    if (!incomingInvite) return
    const roomCode = incomingInvite.roomCode
    setIncomingInvite(null)
    enterPrivateRoomLobby(roomCode)
  }, [incomingInvite, enterPrivateRoomLobby])

  const handlePrivateRoomEnterMatch = useCallback(
    (args: { matchId: string; battleType: BattleFormat; endlessDifficulty: EndlessDifficulty | null; opponentProfile: BattleOpponentProfile }) => {
      setPrivateRoomMatch(args)
      replaceScreen(args.battleType === 'endless' ? 'privateEndlessMatch' : 'privateRoomMatch')
    },
    [replaceScreen],
  )

  /**
   * 次フェーズ（item 15、実機/E2Eで発見した競合の修正）: 試合から戻った直後、
   * PrivateRoomLobbyScreen（毎回アンマウント→再マウントする）のローカルなuseRefだけでは
   * 「この試合にはもう入らない」という記憶が再マウント時に失われる。BattleRoom DO→
   * PrivateRoom DOへの通知（notifyPrivateRoomIfAny）がサーバー権威として先に完了する設計へ
   * 既に修正済みだが、Durable Objectのローカル開発環境（Miniflare）では同一DOへの複数
   * リクエストの厳密な直列化がPlaywright E2Eで再現できる形では保証されないことを確認した
   * （本番Cloudflare環境のinput gate機構でも絶対に発生しないとは限らないため、クライアント
   * 側でも二重の安全網を持たせる）。App.tsx（唯一の永続的な状態を持つ場所）側で
   * 「既に退出した試合ID」を記憶し、ロビーがどれだけ速く再接続してstale気味のactiveMatchを
   * 受け取っても、同じmatchIdへは二度と入らないことを保証する。
   */
  const exitedPrivateMatchIdsRef = useRef<Set<string>>(new Set())
  const isPrivateMatchAlreadyHandled = useCallback((matchId: string) => exitedPrivateMatchIdsRef.current.has(matchId), [])

  // item: PRIVATE ROOMはChallenge・ENDLESS Challengeと同様、強制インタースティシャルの
  // 対象から完全に除外する（ユーザー指示）——exitBattleのようなmaybeGateWithInterstitial
  // ラップを一切行わない。試合→ロビーは同じ深さのflow内遷移なのでreplaceScreenを使う。
  const exitPrivateRoomMatch = useCallback(() => {
    setPrivateRoomMatch((prev) => {
      if (prev) exitedPrivateMatchIdsRef.current.add(prev.matchId)
      return null
    })
    replaceScreen('privateRoomLobby')
  }, [replaceScreen])

  /**
   * 次フェーズ（FRIENDS/TABLE/ナビ追加調整ラウンド、item 46-47）: 本当にルームが消えた
   * （ホストが明示的に閉じた、または6時間無活動で期限切れになった）時だけ呼ばれる——
   * 「← 戻る」「⌂ ホーム」はこれを一切経由しない（部屋への参加状態はサーバー側で
   * 維持され続けるため、単なる画面移動だけで退出扱いにはならない）。
   */
  const [roomClosedNotice, setRoomClosedNotice] = useState<RoomClosedReason | null>(null)
  const handlePrivateRoomClosed = useCallback(
    (reason: RoomClosedReason) => {
      setPrivateRoomCode(null)
      setPrivateRoomMatch(null)
      setRoomClosedNotice(reason)
      goHome()
    },
    [goHome],
  )

  /** 次フェーズ（item 50）: ロビーの中からの「フレンドを招待」。既にこの部屋に居るので、ナビゲーションは一切変えない。 */
  const inviteFriendFromLobby = useCallback(
    (toPlayerId: string) => {
      if (!privateRoomCode) return
      inviteToExistingRoom(toPlayerId, privateRoomCode)
    },
    [privateRoomCode, inviteToExistingRoom],
  )

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
                onOpenFriends={openFriends}
                friendsUnreadCount={friendsUnreadCount}
              />
              {migrationUnlocked.length > 0 && (
                <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex flex-col items-center px-6">
                  <div className="pointer-events-auto">
                    <AchievementUnlockBanner newlyUnlocked={migrationUnlocked} />
                  </div>
                </div>
              )}
              {roomClosedNotice && (
                <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-6">
                  <button
                    onClick={() => setRoomClosedNotice(null)}
                    className="pointer-events-auto anim-pop rounded-full bg-black/80 px-4 py-2 text-xs font-bold text-white/80 active:opacity-70"
                  >
                    {roomClosedNotice === 'host_closed' ? 'ルームが閉じられました' : '6時間操作がなかったため、ルームが終了しました'}
                  </button>
                </div>
              )}
            </>
          )}
          {screen === 'playing' && <PlayScreen key={playKey} onFinish={handleFinish} onQuit={quitToHome} />}
          {screen === 'result' && result && (
            <ResultScreen
              result={result}
              onRetry={() => maybeGateWithInterstitial(() => startPlay('retry'))}
              onHome={() => maybeGateWithInterstitial(goHome)}
              onChallengeSent={handleChallengeSent}
            />
          )}
          {screen === 'endlessSelect' && <EndlessSelectScreen onSelect={startEndless} onBack={popScreen} onHome={goHome} />}
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
              onChangeDifficulty={() => maybeGateWithInterstitial(() => replaceScreen('endlessSelect'))}
              onHome={() => maybeGateWithInterstitial(goHome)}
            />
          )}
          {screen === 'profile' && (
            <ProfileScreen
              onBack={popScreen}
              onHome={goHome}
              onEdit={openProfileEdit}
              onAchievements={openAchievements}
              onRanking={openRanking}
              onSentChallenges={openSentChallenges}
              onParticipatedChallenges={openParticipatedChallenges}
              onOpenPassAnalytics={openPassAnalytics}
              onOpenPassPaywall={() => openPassPaywall('profile')}
            />
          )}
          {screen === 'profileEdit' && <ProfileEditScreen onDone={handleProfileEditDone} />}
          {screen === 'achievements' && <AchievementScreen onBack={popScreen} onHome={goHome} />}
          {screen === 'ranking' && <RankingScreen onBack={popScreen} onHome={goHome} />}
          {screen === 'passAnalytics' && <PassAnalyticsScreen onBack={popScreen} onHome={goHome} />}
          {screen === 'passPaywall' && (
            <PassPaywallScreen source={passPaywallSource} onBack={popScreen} onHome={goHome} onPurchased={handlePassPurchased} />
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
          {screen === 'challengeHistory' && activeChallenge && <ChallengeHistoryScreen challenge={activeChallenge} onBack={popScreen} />}
          {screen === 'challengeSentList' && <SentChallengesScreen onBack={popScreen} onHome={goHome} onOpenHistory={openChallengeHistory} />}
          {screen === 'challengeParticipatedList' && (
            <ParticipatedChallengesScreen onBack={popScreen} onHome={goHome} onOpenHistory={openChallengeHistory} />
          )}
          {screen === 'battleHome' && (
            <BattleHomeScreen onBack={popScreen} onHome={goHome} onWorldBattle={openWorldMatching} onPrivateRoom={openPrivateRoomHome} />
          )}
          {screen === 'battleWorldMatching' && (
            <WorldMatchingScreen
              playerId={getOrCreatePlayerId()}
              profile={toBattleProfile(getProfile())}
              onBack={popScreen}
              onMatchFound={handleWorldMatchFound}
            />
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
              onBack={popScreen}
              onHome={goHome}
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
              onBack={popScreen}
              onHome={goHome}
              onRoomClosed={handlePrivateRoomClosed}
              onEnterMatch={handlePrivateRoomEnterMatch}
              isMatchAlreadyHandled={isPrivateMatchAlreadyHandled}
              presenceSnapshot={presenceSnapshot}
              onSubscribePresence={subscribeFriendPresence}
              onInviteFriend={inviteFriendFromLobby}
              onOpenMemberProfile={openFriendProfile}
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
          {screen === 'friendsHome' && (
            <FriendsHomeScreen
              onBack={popScreen}
              onHome={goHome}
              playerId={getOrCreatePlayerId()}
              hasPass={qaLocalEntitlementRepository.hasEntitlement('PRIVATE_ROOM_CREATE')}
              presenceSnapshot={presenceSnapshot}
              onSubscribePresence={subscribeFriendPresence}
              onOpenFriendProfile={openFriendProfile}
              onRequirePass={() => openPassPaywall('other')}
              onInviteToExistingRoom={inviteToExistingRoom}
              onCreateRoomAndInvite={createRoomAndInvite}
            />
          )}
          {screen === 'friendProfile' && friendProfilePlayerId && (
            <FriendProfileScreen onBack={popScreen} onHome={goHome} playerId={friendProfilePlayerId} viewerPlayerId={getOrCreatePlayerId()} />
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
      {incomingInvite && (
        <RoomInviteBanner fromProfile={incomingInvite.fromProfile} onAccept={acceptRoomInvite} onDismiss={() => setIncomingInvite(null)} />
      )}
    </div>
  )
}
