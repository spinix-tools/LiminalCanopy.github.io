# 段流 / GEARFLOW
2026-11-25 | 静的Web MVP

## 対象・選定理由
ロードバイク利用者、室内練習者、自転車店。2025年富士ヒルは8,748人出走（[FUNRiDE](https://funride.jp/events/the21stmtfujihc-data/)）。米国では2024年に年1回以上乗車した3歳以上が1.12億人との推計（[PeopleForBikes](https://www.peopleforbikes.org/news/bicycling-participation-report-2024)）。いずれも本ツールの直接需要・支払意思ではない。

## 競合・差別化仮説
国内の[ToolsAhuro](https://tools.ahuro.com/tools/gear-ratio)はギア比・速度一覧、海外の[BikeGearCalc](https://www.bikegearcalc.com/)は構成比較、[Shimano E-TUBE](https://bike.shimano.com/ja-JP/technologies/details/shimano-synchronized-shift.html)は対応機器の前後変速連携を提供。段流は機器接続なしで想定速度・区間時間の列全体について、ケイデンス逸脱と前後変速の負担を同時に比較する。自転車店でのギア選定・室内練習の事前検討に利用できるという仮説。実需要は未検証。既存ブランチ差分300ファイルと自転車・cadence・gear shift・ギア比のコミット検索、直近履歴を確認（全件照合ではない）。

## 使用法・モデル
index.htmlをブラウザで開く。前後歯数、実測周長、rpm帯、前変速/後1段の負担点、速度・時間列（最大120区間）を設定。CSV出力・印刷。1〜2前ギア、2〜14後ギア。各区間のrpmは速度×1000000/(60×周長mm)×後歯数/前歯数。費用は帯外rpm×分＋中心からの距離×0.1×分＋前変速負担＋後段数負担。DPで区間境界の全候補を探索し、独立選択と比較。初期ギア自由。指定した離散モデルのみで最適。初期例：前変速4→0、後段数27→17、帯外0→3分、費用253.4→85.2。交換途中の状態、負荷、部品互換性、チェーンライン実測、実走安全性は対象外。走行中は使用しない。外部通信・登録・API課金なし。

## 検証
`node test.cjs`：独立全列挙300条件、固定・上限7件合格。`python browser_test.py`（Playwrightと/usr/bin/chromiumが必要）：HTMLインライン読み込みで初期表示、CSVダウンロード、編集、入力エラー、リセット、390px、JS例外・HTTP要求なしを確認。実機・印刷出力・収益性は未検証。
