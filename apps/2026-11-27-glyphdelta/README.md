# GlyphDelta — フォント更新監査 / Font release regression audit

## ターゲット・選定理由
日本語サイトの制作者、ゲームUI・多言語QA、フォントの差し替えやサブセット化を担当する開発者。和文では異体字を含む多数の文字の収録が問題になり、軽量化の際の文字欠落を検出する用途がある。Google Fontsも指定文字による最適化を提供している。調査日：2026-11-27。

## 競合・差別化仮説
- 国内：Fontmiru（和文組見本・収録グリフ検査） https://github.com/toktaro/Fontmiru/blob/main/README_JP.md
- 海外：Glyph Batch（文字カバレッジ・サブセット） https://www.glyphbatch.com/glyph-coverage/ 、Birdor（言語別の不足文字） https://birdor.com/en/tools/font-coverage-checker/
- Font Studio（比較・収録文字検査） https://tools.itlibra.com/en/font-studio
- 需要の手掛かり：日本語フォント自己ホスト・サブセット化事例 https://zenn.dev/ukintech/articles/japanese-font-selfhost-subset 、Google Fonts https://developers.google.com/fonts/docs/css2

競合も収録文字の比較機能を持つ。旧版と新版の実ファイルを同じページ別コーパスで比較し、新規消失・既存欠落・追加を分離、影響ページと出現回数を提示するリリース前監査に特化。市場規模・収益性・独占性は未検証。直近のアプリ履歴、mainとの差分300ファイル（51ディレクトリ）、font/glyph/subset/文字種/フォントのコミット検索で明確な重複なし。全履歴の網羅照合ではない。

## 使い方
index.html をブラウザで開く。サンプルが自動表示される。旧版・新版の単体TTF/OTFを選択し、ページ名と表示テキストをタブ区切りで入力。差分を検査し、文字別の状態で絞り込み、全件JSONを保存する。各フォント30 MiB以下、200行・50,000コードポイントまで。端末内処理のみ、登録・外部依存・APIなし。

## 検証結果
- 3種類の実フォント（DejaVu Sans、Lato、Inter）で全Unicode範囲1,114,112コードポイントずつ、計3,342,336件をFontTools getBestCmapと照合し一致（format 4/12、TTF/OTF）。固定アサーション8件合格。
- Chromium（同一HTMLのインライン読込）：架空サンプル、実TTFと生成サブセットのファイル入力、消失文字抽出、フィルター、JSONダウンロード、入力編集後の結果無効化、不正入力、390px横幅、JS例外0・外部HTTP要求0を確認。
- 再現：Node.js、PythonのfontTools・playwright、Chromium、test.pyに記載したシステムフォントを用意して `python test.py`。フォントファイル自体は同梱しない。

## 制限
Unicode cmap format 4/12のうち優先順位で選んだ1テーブルを検査する（format 12優先、同形式はWindows優先）。非ゼロのグリフIDを収録とみなす。空白・制御・書式・異体字セレクタを除外。IVS、書体品質、字形差、シェーピング、CSS/OSフォールバック、ライセンス、WOFF/WOFF2/TTCは未対応。収録は表示成功を保証しない。実装参考： https://learn.microsoft.com/ja/typography/opentype/spec/cmap
