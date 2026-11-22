# 桁まもり / KETAMAMORI

**ExcelなどでCSVを開く前に桁落ち・数式化・列ずれを点検するブラウザアプリ**（2026-11-22）。

## 対象と市場選定
対象: 小規模ECのCSV担当、学校・自治体の事務担当、システム連携の運用者。

日本の財務省は、CSVをExcelで開くと「先頭の0が消える」「文字化けする」と公式FAQで注意を促している。Microsoftは先頭ゼロの欠落と16桁以上の数値の自動変換を説明している。既存の業務上の痛点に着目した案であり、市場規模や支払意思は**未検証**。

- [財務省のCSV FAQ](https://www.mof.go.jp/faq/statistics/12ua.htm)
- [Microsoft Excel — 先頭ゼロと大きい数値の保持](https://support.microsoft.com/ja-jp/excel/keeping-leading-zeros-and-large-numbers)
- [デジタル庁の文字標準化施策（2026-08-18更新）](https://www.digital.go.jp/policies/local_governments/character-specification)

## 競合・差別化仮説

国内の [CSV Dock](https://csvdock.com/ja) は文字化け・先頭ゼロの確認とXLSX保存に対応し、[KantanTools](https://kantantools.net/tools/csv-diagnostic/) はCSV総合診断を提供。海外の [CSVLint](https://csvlint.io/about) は構文/スキーマ、[RowSlice](https://rowslice.com/validate-csv/) はブラウザ内の行・IDの検査に対応。**直接・近接競合は強い**。

差別化仮説: ファイルを変換する前に、数式開始文字・長いID・日付候補をセル単位で示し、担当者の確認済チェック、レポート出力、危険な列数・引用符エラーを拒否するエクスポート制御を組み合わせること。

## このGitHub版の機能

`index.html` を開く。依存ライブラリやサーバー不要。CSV/TSVファイル（最大8MB）読込、文字コード手動選択（UTF-8/Shift_JIS/EUC-JP）、区切り推定、セルの元文字列プレビュー、桁落ち/数式・列数/引用符エラー検知、確認済チェック、指摘CSV、整形CSV出力、式文字列の任意エスケープ、短行の任意補完に対応。入力はネット送信しない。MITライセンス。

**リリースの違い:** このGitHub版は軽量な単一HTML実装。ZIPとして納品した完全版（分割ソース・単一HTML・単体テスト・ブラウザテスト・画像を含む）とは別の実装であり、同じテスト結果を流用できない。

## 検証結果・限界

- **完全版**（別添ZIP）: Node.js **16/16合格**（1000回のランダムCSVラウンドトリップ含む）、Chromium **32/32合格**、外部HTTP要求/JS例外0件。ローカルURL制限により同じHTMLをPlaywright `set_content` で検証。
- **GitHub版**: 保存と再取得は確認するが、完全版テストはこの軽量版の操作試験を意味しない。
- 桁落ちや日付化はリスクの推定であり、Excel全バージョンの挙動を再現しない。数式の前にアポストロフィを付加すると値自体が変わる。CSVを書き出すだけではExcelで先頭ゼロを維持できないので、**Excelの「データ → テキストまたはCSVから」取り込みを使い、識別子列をテキスト型に指定**する。必ず原本を保管する。文字コードは意味的に自動確定できない。

新規API課金、有料サービス、秘密情報・個人情報の収集は行わない。
