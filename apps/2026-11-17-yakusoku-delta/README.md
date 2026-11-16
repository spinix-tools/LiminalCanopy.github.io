# やくそく差分 / YAKUSOKU DELTA

2026年11月17日制作。発注メール・見積合意・取引条件の **新旧テキストの変更を見落とさないためのブラウザアプリ**。

## 対象と選定

- **対象**: フリーランス、個人デザイナー、小規模制作事業者。
- **日本の需要シグナル**: 公正取引委員会はフリーランスへの取引条件明示、支払期日の特定を説明。2025年度の近畿地区の運用状況（2026-06-26公表）は、取引条件の明示義務違反139件、報酬支払期日義務違反131件と報告。ただしアプリ需要を直接測ったデータではない。
- **国内競合**: LAWGUEは文書差分比較・履歴管理を提供。**海外競合**: DraftableはWord/PDF/テキスト比較を提供し、無料オンライン比較では文書をクラウド処理。Online Diff Checkerなどローカル比較の競合も存在する。
- **差別化仮説**: 日本語の短い発注条件に限定し、金額・日付・割合・期間・条件語の変更を優先表示し、一件ごとの確認ステータスと確認メモ出力まで登録なしで完結させる。新規性・収益性は未検証。

## 機能

行単位の新旧比較、数値と条件語の変更候補の強調、追加・削除の一覧化、個別の「未確認／確認済み／質問中」管理、CSVまたはMarkdown出力、JSONバックアップ・復元、サンプル、スマホ対応。

## 実行方法

`index.html`を同じフォルダの`engine.js`、`app.js`と一緒にブラウザーで開く。追加APIやログイン・課金なし。アプリ本体は通信・個人情報収集・自動保存を行わない。エクスポートしたファイルには入力文面が含まれるため自身で保管する。

## テストと限界

ローカルのフル版MVPではNode単体試験25/25件、Chromium UI試験23/23項目に合格（Chromiumでは環境制約によりHTML・JSを直接注入）。実端末・実サイト・GitHub配信での動作は未検証。行対応は近似計算であり、表・PDF・Word・法的な効果の評価は行わない。キーワードの有無は法的充足を意味しない。**法律上の判断が必要なら必ず原文全体と専門家を確認すること。**

## 出典（2026-11-17確認）

- 公正取引委員会: https://www.jftc.go.jp/freelancelaw_2026/index.html
- 公正取引委員会 近畿地区（2026-06-26）: https://www.jftc.go.jp/houdou/pressrelease/2026/jun/260626_kinki_fl_unyo.html
- LAWGUE: https://lawgue.com/functions/
- Draftable: https://www.draftable.com/compare
- Draftableのオンライン比較の扱い: https://www.draftable.com/security/online
- Online Diff Checker: https://onlinediffchecker.com/fr/privacy/

保存先: `spinix-tools/LiminalCanopy.github.io` の **`hourly-app-lab`** ブランチの `apps/2026-11-17-yakusoku-delta/`。既存`main`・公開サイトは変更しない。
