import { useState } from 'react'
import { AdSlot } from '../components/AdSlot'
import { HeartDisplay } from '../components/HeartDisplay'
import { AD_START_SCREEN, ADS_ENABLED_V6 } from '../config/ads'
import { HOME_MODES, type HomeModeId } from '../config/homeConfig'
import { TITLE_TEXT } from '../config/messagesV4'
import { AchievementQaPanel } from '../dev/AchievementQaPanel'
import { HeartQaPanel } from '../dev/HeartQaPanel'
import { PassQaPanel } from '../dev/PassQaPanel'
import { isHeartQaPanelRequested, isPassQaPanelRequested } from '../dev/overdrivePreview'
import { qaLocalEntitlementRepository } from '../payment/entitlementRepository'
import { qaSetHeartCount } from '../utils/heartRepository'
import { sfx } from '../utils/sound'
import { getBestPercent } from '../utils/storage'

interface Props {
  onStart: () => void
  /** Ver.6 Phase 4: Endless難易度選択画面への入口。 */
  onStartEndless: () => void
  /** Ver.6 Phase 6（1対1リアルタイム対戦）: BATTLE（世界対戦・フレンド対戦）への入口。 */
  onStartBattle: () => void
  /** Ver.6 Phase 5: Profile/Achievement/Rankingへのサブ導線。 */
  onOpenProfile: () => void
  onOpenAchievements: () => void
  onOpenRanking: () => void
  /** 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 27）: フレンド一覧への入口。 */
  onOpenFriends: () => void
  /**
   * 次フェーズ（FRIENDS/TABLE/ナビ追加調整ラウンド、item 49）: 届いている友達申請＋
   * ルーム招待の合計数。0より大きい間だけ、FRIENDS入口に小さな未読バッジを出す。
   */
  friendsUnreadCount: number
}

/**
 * Ver.6 Phase 7（ホーム画面最終UI改善、実機QA確定）: 3モード（DOPA RUSH/ENDLESS/
 * ONLINE BATTLE）を同格のカードとして並べる構成自体はPhase 6から維持しつつ、
 * 名称・サブコピー・配色をconfig/homeConfig.tsのデータに基づいて描画するよう
 * 書き換えた（英語タイトルを主役にし、その下に短い日本語説明を添える）。
 * Profile/Achievement/Rankingは従来どおり控えめなテキストリンクのまま維持する。
 *
 * 次フェーズ（FRIENDS/TABLE/ナビ追加調整ラウンド、item 49）: 下段のサブ導線は
 * PROFILE/ACHIEVEMENT/RANKINGの3つだけに戻した（前ラウンドでFRIENDSを追加した結果、
 * 390px幅で4項目が収まらずレイアウトが崩れていた）。FRIENDSは代わりに画面上部・
 * 左上（Heart表示が右上にあるのに対して、左右のバランスを取る位置）に、3枚の
 * モードカードより明らかに控えめな小さい入口として独立させた。
 */
export function TitleScreen({
  onStart,
  onStartEndless,
  onStartBattle,
  onOpenProfile,
  onOpenAchievements,
  onOpenRanking,
  onOpenFriends,
  friendsUnreadCount,
}: Props) {
  const best = getBestPercent()
  // 次フェーズ（DOPA PASS基盤ラウンド）: PassQaPanelでの切り替えを即座に全PASS依存UIへ
  // 反映させるための再評価トリガー（qaLocalEntitlementRepositoryはlocalStorage読み取りのため
  // Reactのstateではなく、この値を変えて強制的に再読み込みさせる）。
  const [, setPassRevision] = useState(0)
  const hasUnlimitedHeart = qaLocalEntitlementRepository.hasEntitlement('UNLIMITED_HEART')

  const handlers: Record<HomeModeId, () => void> = {
    rush: onStart,
    endless: onStartEndless,
    battle: onStartBattle,
  }

  return (
    <div className="flex min-h-dvh flex-col items-center gap-5 px-6 py-8 text-center">
      <div className="flex w-full items-start justify-between">
        <button
          onClick={() => {
            sfx.uiTap()
            onOpenFriends()
          }}
          className="relative flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white/60 active:scale-95"
          aria-label={`FRIENDS${friendsUnreadCount > 0 ? `（未読${friendsUnreadCount}件）` : ''}`}
        >
          <span aria-hidden="true">👥</span>
          <span>FRIENDS</span>
          {friendsUnreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black leading-none text-white"
            >
              {friendsUnreadCount > 9 ? '9+' : friendsUnreadCount}
            </span>
          )}
        </button>
        <HeartDisplay unlimited={hasUnlimitedHeart} />
      </div>
      {/* Ver.6 Phase 9（実機QA反映）: 広告（下部100px枠）を非表示にしたことで、タイトル〜
          PROFILE/ACHIEVEMENT/RANKINGのまとまり全体がjustify-centerのままだと画面上寄りに
          見えるようになった。カード自体のサイズ・配色・フォントサイズは一切変えず、
          上下の余白比率だけを変えて「まとまり全体の重心」を少し下へ動かす
          （上スペーサーより下スペーサーを大きくすることで、まとまりは下方向にシフトする）。 */}
      <div aria-hidden="true" className="flex-[1.6]" />
      <h1 className="text-4xl font-black tracking-tight">{TITLE_TEXT.heading}</h1>

      <div className="space-y-2 text-base font-bold leading-relaxed text-white/85">
        {TITLE_TEXT.lines.map((line) => (
          <p key={line} className="whitespace-pre-line">
            {line}
          </p>
        ))}
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2">
        {HOME_MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={handlers[mode.id]}
            className={`w-full rounded-2xl py-2.5 text-white transition-transform active:translate-y-1 active:shadow-none ${mode.gradientClass} ${mode.shadowClass}`}
          >
            <span className="flex flex-col items-center gap-0.5">
              <span className="flex items-center gap-1.5">
                <span className="text-xl leading-none" aria-hidden="true">
                  {mode.icon}
                </span>
                <span className="text-xl font-black leading-none tracking-widest">{mode.titleEn}</span>
              </span>
              <span className="text-[11px] font-bold text-white/90">{mode.subJa}</span>
            </span>
          </button>
        ))}
      </div>

      {best > 0 && <p className="text-xs text-white/40">自己ベスト：ドパガキ度 {best}％</p>}

      {/* Ver.6 Phase 5: Profile/Achievement/Rankingへのサブ導線。ゲームモード選択の主導線を
          弱めないよう、あくまで控えめな小さいテキストリンク3つに留める
          （アプリの管理画面のような見た目にしない）。 */}
      <div className="flex items-center gap-4 text-[11px] font-bold text-white/35">
        <button
          onClick={() => {
            sfx.uiTap()
            onOpenProfile()
          }}
          className="flex items-center gap-1 active:text-white/60"
        >
          <span aria-hidden="true">👤</span> PROFILE
        </button>
        <span className="text-white/15">|</span>
        <button
          onClick={() => {
            sfx.uiTap()
            onOpenAchievements()
          }}
          className="flex items-center gap-1 active:text-white/60"
        >
          <span aria-hidden="true">🏆</span> ACHIEVEMENT
        </button>
        <span className="text-white/15">|</span>
        <button
          onClick={() => {
            sfx.uiTap()
            onOpenRanking()
          }}
          className="flex items-center gap-1 active:text-white/60"
        >
          <span aria-hidden="true">📊</span> RANKING
        </button>
      </div>

      {ADS_ENABLED_V6 && (
        <AdSlot adTag={AD_START_SCREEN.tag} width={AD_START_SCREEN.width} height={AD_START_SCREEN.height} label={AD_START_SCREEN.slotName} />
      )}
      <div aria-hidden="true" className="flex-[1]" />
      {isHeartQaPanelRequested() && <HeartQaPanel onSet={(count) => qaSetHeartCount(count)} />}
      {isPassQaPanelRequested() && <PassQaPanel onChange={() => setPassRevision((r) => r + 1)} />}
      {/* 次フェーズ（item 127）: 前ラウンドで実装したAchievement/Title QAパネル
          （AchievementQaPanel.tsx）は?preview=achievementというURLクエリ経由でしか
          開けず、実機Preview上に発見可能な入口が無かった。ここではHeartQaPanel/
          PassQaPanelと同じ__DOPAGAKI_PREVIEW_ENABLED__ガード（Productionビルドでは
          常にfalseになる定数）を直接使い、クエリパラメータなしでHome画面に小さな
          「🔧 QA」入口を常設する。新しいガードロジックは作らず、既存の
          __DOPAGAKI_PREVIEW_ENABLED__と既存のAchievementQaPanel/achievementQaRepository
          をそのまま再利用しているため、Productionでの構造的無効化（ボタン非表示＋
          QA関数自体がno-op）は従来どおり保たれる。 */}
      {__DOPAGAKI_PREVIEW_ENABLED__ && (
        <AchievementQaPanel label="🔧 QA" positionClassName="bottom-16 right-3" onChange={() => setPassRevision((r) => r + 1)} />
      )}
    </div>
  )
}
