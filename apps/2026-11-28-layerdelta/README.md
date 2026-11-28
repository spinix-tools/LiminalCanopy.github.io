# LayerDelta / CSS変更差分

## 対象・選定理由
Web制作会社、デザインシステム担当者、Tailwind v4移行担当者。レイヤー移行で通常宣言と!importantの優先順位が逆方向に変わるため、複数の要素・幅で回帰を確認したい需要を想定。日本ではラクスの技術ブログがレガシーCSSの詳細度管理の難しさを紹介。海外ではTailwind v4がネイティブレイヤーに移行。需要・売上の規模は未計測。

- 国内: https://tech-blog.rakus.co.jp/entry/20211210/layer
- 仕様（日本語）: https://developer.mozilla.org/ja/docs/Web/CSS/Reference/At-rules/%40layer
- 海外: https://tailwindcss.com/docs/upgrade-guide
- 競合: https://bytemasher.org/css/specificity （優先順位検査）、https://kivtools.com/csslayers/ （レイヤー計画）、https://learn.microsoft.com/en-sg/microsoft-edge/devtools-guide-chromium/inspect-styles/edit-fonts （DevTools）

## 差別化仮説
単一要素の優先順位計算ではなく、変更前後のCSSを同じ構造・複数幅で実際に評価し、getComputedStyleの返す値の差分を一覧・JSON化する。独自のCSS解析器は使わない。CSS移行の小規模な回帰テストに特化する。競合に同種機能がないことまでは未確認。既存283アプリのディレクトリ名と直近の制作履歴を確認。全既存ソースの照合は未実施。

## 利用法
index.htmlを現代的なブラウザで開く。CSSを前後に貼り、JSONで要素構造を定義（nameを付けた要素のみ測定）。幅240〜2000pxを最大6種、プロパティ20種、要素100個まで。CSS各50,000文字。高さ600px固定。検査、差分フィルタ、JSON保存が可能。入力は端末内処理。外部リソースはCSPで遮断、サンドボックス内ではスクリプトを禁止。個人情報・秘密情報を入力しないこと。

## テスト結果（2026-11-28）
`python test_browser.py`（Python / Playwright / Chromium、同一HTMLをset_contentで読み込み）。6グループ合格。通常宣言・importantのレイヤー反転、メディアクエリ、JSONダウンロード、フィルタ、同一CSS、入力変更で旧結果破棄、不正幅・禁止タグ、外部リソース要求のCSP遮断、HTML文字列の非実行、12,000測定項目、390px表示を確認。JS例外なし。外部HTTP応答なし、試行された外部要求は全件CSPブロック。サンプル16項目中4項目の色が変化。

## 限界
実サイト全体の再現、外部CSS・フォント、任意HTML属性、操作状態、アニメーションの時刻固定、CSS構文エラーの診断、差分の原因特定、画像差分、他ブラウザは対象外。getComputedStyleの文字列差分であり、見た目の同一性や不具合の有無は保証しない。file://直接起動は検証環境の制限で未確認。追加有料API・外部サービス不要。
