# TokenScope — CSS継承ラボ

2026-11-28 / MVP v1.0

## 対象・選定理由
フロントエンド開発者、デザインシステム担当者、CSS学習者。テーマの色や余白を上書きしても、祖先で計算済みの別名トークンは自動で再解決されない場合がある。日本語MDNの継承解説と国内のダークモード解説、海外のデザイントークン記事から具体的な課題を確認。市場規模、検索数、収益性は未検証。

## 競合・差別化仮説
- 国内資料: [MDN 日本語](https://developer.mozilla.org/ja/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties)、[RJC](https://www.r-jc.jp/news-blog/1595/css%E5%A4%89%E6%95%B0%E3%82%AB%E3%82%B9%E3%82%BF%E3%83%A0%E3%83%97%E3%83%AD%E3%83%91%E3%83%86%E3%82%A3%E3%81%AE%E4%BD%BF%E3%81%84%E6%96%B9%E3%82%B3%E3%83%94%E3%83%9A%E5%AE%9F%E4%BE%8B%E3%81%A8%E3%83%80%E3%83%BC%E3%82%AF%E3%83%A2%E3%83%BC%E3%83%89%E5%88%87%E6%9B%BF/)
- 海外: [Minh Vo](https://minhvo.site/blog/design-tokens-with-css-custom-properties/)、[ToolSorcerer](https://toolsorcerer.com/css_variable_dependency_auditor)、[VoriTools](https://voritools.com/cssvars/)、[DevBricks](https://tools.devbrickstech.com/tools/css-custom-property-dependencies)。後三者は公開説明上、主に静的参照解析で、要素別の計算値は対象外。
- 本作は3階層を実ブラウザで計算し、継承されたvar()宣言を一つ再宣言した場合の波及差分を確認できる。静的解析の補完を狙う。独自性は仮説であり全競合の網羅調査は未実施。
- 重複調査: 直近の会話内の制作履歴、専用ブランチ比較の取得可能な51ディレクトリ、TokenScope/CSS variable/custom property/デザイントークンのコミット検索（各0件）では明確な重複なし。全ソース照合ではない。

## 利用方法
index.html をブラウザで開く。Root/Theme/Componentに各50行までのカスタムプロパティ宣言を入力し、検査。再宣言先と対象を選択すると修正案、計算値差分、JSONを得られる。外部依存なし、入力の外部送信なし。

## テスト結果
Chromium + Playwrightで同一HTMLをインライン読み込み（環境のfile URL制限）。継承、子・孫への再宣言、連鎖別名が固定される例、循環とfallback、3種類の不正入力、旧結果の無効化、JSON実ダウンロード・内容照合、390px幅、JS例外と外部HTTP要求0件を確認。`python test_browser.py` で再現（Chromiumのパスは環境に応じて変更）。
サンプル: --surfaceをThemeで再宣言すると2セル変化、Componentなら1セル変化。--cardは元の値のまま。

## 制限
ASCII名・限定的な値構文、1行1宣言、未登録カスタムプロパティのみ。任意のCSS、セレクター、詳細度、@property、実ページの全カスケードは対象外。空文字の意味は区別しない。比較は計算値の文字列で、色や長さの意味的同値性・最終消費プロパティは未検証。別ブラウザ、最大規模の性能、実利用需要は未検証。
