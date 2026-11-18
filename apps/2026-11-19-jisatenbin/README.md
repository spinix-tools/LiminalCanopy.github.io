# 時差てんびん / JISA TENBIN 🌏

**誰か一人の深夜にしない。** 週次の国際チーム会議を「主催地の時刻固定」「UTC時刻固定」「過去の負担を考慮した輪番」で比較する、端末内完結の日本語Webアプリ。2026-11-19制作。

## ターゲット・選定理由

国内から欧米・アジア拠点と定例会議を行う小規模開発チーム、越境事業者、海外パートナーの進行担当者。日本のリモートワークが一律に拡大しているとは言えないが、Gartner Japanの2025-07-31調査でも企業のリモートワークが引き続き存在することが分かる。世界的にはMicrosoftの2025年Work Trend Indexが**会議の約3分の1が複数タイムゾーンを跨ぐ**と報告。Microsoft Researchの2023年発表の2,000万会議分析では、早朝・深夜の会議負担が地理や職位により非対称と報告している。

## 競合調査（実際に確認した公開ページ）

| 市場 | 競合・特徴 | 差分の仮説 |
|---|---|---|
| 国内・日本語利用 | [timeanddate Meeting Planner](https://www.timeanddate.com/worldclock/meeting-help.html)（時差・DST・候補時刻） | 日本語の負担点説明、複数週3案比較に特化 |
| 海外 | [UnisonTime](https://unisontime.com/)（勤務時間・食事・祝日・ICS） | 3種の固定／輪番方式の累積比較に集中 |
| 海外 | [FairTime](https://fairtime.net/)（公平性履歴・DST・ICS） | あえて公平案以外の固定2案も同一基準で定量比較 |
| 海外 | [DigiTools Fair Meeting Rotation](https://usedigitools.com/meetings/fair-meeting-rotation)（輪番・固定比較） | 日本語、過去負担の手入力、時刻別48候補とDST注記の一画面化 |

**差別化は仮説**。輪番・公平スコアも登録不要アプリも既に存在し、世界初の機能だとは主張しない。日本語で「固定時刻の安定性を選ぶか、負担の偏りを減らすか」のトレードオフを説明可能な小型ツールとして検証する。

## MVPの操作

1. `index.html`をブラウザで開く。サーバー・登録・APIキー不要。
2. 初回日付、2〜12回の週次回数、30/60/90分、基準地域を選ぶ。
3. 2〜8拠点のIANAタイムゾーン、現地勤務時間（同日内）、過去負担点を編集する。
4. 3つの開催方針で「最大累積負担」「今回の総負担」「累積格差」と現地時刻を比較する。
5. 48候補を押して詳細を見たり、固定時刻を手動選択できる。
6. ICS・CSVをダウンロード、JSONバックアップ・復元、端末内自動保存を利用できる。

### 負担点アルゴリズム

各会議を15分単位で評価。勤務時間内の平日は0点、時間外の平日は1時間あたり1点、22:00〜07:00の時間外は1.8点、土日は2.1点。週末を優先する。過去負担点を累積合計に含め、輪番の各週候補を「累積最大値 + 0.58×(最大−最小) + 0.14×累積合計」で貪欲選定。**近似手法であり最適性・公平性を保証しない**。基準時刻の固定とUTC時刻の固定は、夏時間を跨ぐと別の計画になり得る。日時は `Intl.DateTimeFormat` とIANAタイムゾーンで計算し、存在しないDST時刻は候補から除外する。

## テスト結果

- `node --test engine.test.cjs` → **40/40合格**。DST切替・春の存在しない時刻、半時間・45分UTC差、週末、勤務時間、スコア、3戦略、ピン固定、CSV/ICSなどを確認。
- `python browser_test.py` → **41/41 Chromium実操作アサーション合格**。参加者編集・固定時刻・DST・JSON入出力・ICS/CSV実ダウンロード・模擬localStorage復元・モバイル幅の検査。
- JavaScript構文検査：`node -c engine.js && node -c app.js` → 合格。
- **ブラウザ検証の制約**：管理環境が `file://` 遷移を `ERR_BLOCKED_BY_ADMINISTRATOR` で遮断したため、同じHTML/CSS/JSをインライン展開して実ブラウザ操作を実施。localStorageは模擬。通常ブラウザでの`file://`直接起動、長期間の永続保存、カレンダー製品へのICS取り込みは未検証。

## データと限界

外部へのfetch・API通信、アカウント、課金、個人情報の収集は実装していない。入力内容はブラウザlocalStorageのみ（エクスポート時は指定先ファイル）。実際の予定衝突、祝日・休暇、各人の同意、適正な労務管理や健康への配慮は別途確認が必要。日を跨ぐ勤務シフトはMVP対象外。タイムゾーン・過去負担の設定は利用者が管理する。

## 参照資料

- Gartner Japan (2025-07-31): https://www.gartner.co.jp/ja/newsroom/press-releases/pr-20250731-remote-work
- Microsoft WorkLab (2025): https://www.microsoft.com/en-us/worklab/work-trend-index/breaking-down-infinite-workday
- Microsoft Research CHI 2023: https://www.microsoft.com/en-us/research/publication/challenging-but-connective-large-scale-characteristics-of-synchronous-collaboration-across-time-zones/
- 公開競合ページは上表を参照。いずれも2026-11-19時点に確認。

## ライセンス

MIT。`LICENSE`を参照。