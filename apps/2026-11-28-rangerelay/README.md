# RangeRelay — フォント配信差分 / Webfont delivery diff

2026-11-28 MVP。対象：日本語・多言語サイトのフロントエンド開発者、制作会社、Webフォントの自己ホスト担当者。

## 選定理由・差別化仮説
日本語フォントは収録文字数が多く、分割配信やサブセット化で容量を抑える一方、更新後の文字欠けや担当変更に注意が必要。国内では [temoto.app](https://temoto.app/font-subset/) がサブセット作成、[Zennの実測事例](https://zenn.dev/ukintech/articles/japanese-font-selfhost-subset) が軽量化と保守の課題を示す。海外では [Glyph Batch](https://www.glyphbatch.com/glyph-coverage/) が実フォントの収録文字検査、[glyphhanger](https://www.npmjs.com/package/glyphhanger) が使用文字抽出・サブセット作成、[ToolBase](https://free-toolbase.com/en/unicode-range-generator/) が範囲生成を提供する。RangeRelay は生成ツールを置き換えず、同一テキストで旧・新の複数ファイルの優先順・欠け・担当変更・担当容量を差分検査する。競合の全機能、市場規模、収益性は未検証。

仕様参照：[MDN日本語](https://developer.mozilla.org/ja/docs/Web/CSS/Reference/At-rules/%40font-face/unicode-range)、[CSS Fonts 4 §4.5](https://www.w3.org/TR/css-fonts-4/#unicode-range-desc)。

## 使い方
`index.html` をブラウザで開く。各計画は1行1ファイル、タブ区切りで ID / KiB / 宣言 unicode-range / 実収録範囲（任意、`-` は空集合）を記入。後の行ほど優先。実収録欄を省くと宣言と同じと仮定する。比較対象の架空テキストを貼り付け、差分検査・絞り込み・JSON保存。各計画最大100行、1欄512範囲、5,000種類の文字、UTF-16 40,000単位。空白文字は検査、改行・タブは除外。サンプルは9種、未カバー0→1種（𠮷）、担当容量225→175 KiB。

## 検証
`node test.cjs`：固定12件、独立した線形探索との500生成計画ペア照合、上限100ファイル・5,000種ケース合格。`python browser_test.py`：Chromiumで同一HTMLをインライン読込（環境のfile://制限）、サンプル・フィルタ・JSON実ダウンロード・入力無効化・異常入力・リセット・390px幅を確認。JS例外・HTTP(S)要求0件。

## 制限・プライバシー
同じ family/style/weight/stretch の宣言を入力順に評価する単一コードポイントモデル。フォントバイナリ解析・CSS自動解析、シェーピング、異体字セレクタ、ダウンロード失敗、キャッシュ、実ブラウザのフォント選択・通信量は対象外。担当容量は使用が想定されたIDのサイズ合計であり、試行後不採用ファイル等の実転送を含まない。入力はブラウザ内のみで処理し保存・送信しない。外部API・有料サービス・追加依存なし。個人情報や秘密情報の入力不要。

## 重複確認
会話内の直近案、mainとhourly-app-labの比較結果に含まれる51アプリディレクトリ、リポジトリのコミット検索（unicode-range / font subset / glyph coverage / font、各0件）を確認。全履歴・全ソース網羅は未実施。
