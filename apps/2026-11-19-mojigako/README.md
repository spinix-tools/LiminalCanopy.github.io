# 文字がこ / MOJIGAKO — 多言語UIの文字枠プレビューとLQA

作成日: 2026-11-19 / 静的・登録不要の実用MVP。`index.html`をブラウザで開くだけ。外部API・npm・有料サービス・秘密情報の設定は不要。

## 対象・選定理由
日本語アプリを英語化する個人開発者・小規模プロダクトのデザイナー・LQA担当者。翻訳文が同じボタンやカードに収まらず、`{name}` などの変数が失われる失敗を、本番ビルド前に調べたいユーザー向け。

**需要の傍証**（アプリ固有の需要ではない）:
- 日本: [イー・ガーディアンのLQAサービス](https://www.e-guardian.co.jp/service/global/lqa/) は、翻訳前後の表示範囲・UI見切れを検証対象として説明している。2026-11-19 確認。
- 日本: [Preferred Localization（プリロカ）](https://l10n.preferredai.jp/) は翻訳と品質レビュー、開発連携を提供。2026-11-19 確認。
- 海外: [Lokalise の擬似ローカライズ解説](https://docs.lokalise.com/en/articles/2348943-pseudolocalization) は翻訳前のUI膨張検査を説明（2026年公開更新、2026-11-19確認）。

## 既存競合と差別化仮説
- 国内/日本語: [Loclint](https://loclint.com/ja) は変数・UIはみ出し等の自動LQA、[Preferred Localization](https://l10n.preferredai.jp/) はAI翻訳・QA・用語管理まで提供。
- 海外: [Nobuf i18n QA Checker](https://nobuf.com/tools/i18n-localization-checker) は多形式・プレースホルダー比較・ローカル疑似翻訳を提供。[Lokalise](https://docs.lokalise.com/en/articles/2348943-pseudolocalization) には専用の擬似ローカライズ機能がある。

**仮説:** 静的な文字列リストに対するLQA自体は既存技術。**日本語原文と英語訳文に、キーごとの「利用可能なpx幅」「最大行数」を直接対応づけ、実ブラウザでの文字幅近似とボタン状プレビューをワンクリック修正で反復できる**小さなツールなら、導入設定を嫌う個人制作者のリリース前チェックを短縮できる。国内外競合に対する優位性・収益性・ヒット可能性はまだ実証していない。

## MVPでできること
- フラット形式 `{ "button.save": "保存" }` の日本語・英語JSON貼付／ファイル読込、最大300キー。
- 未翻訳、余剰キー、未変更、`{name}`・`{{name}}`・`%s`・`%2$s` 等のプレースホルダー個数/種類不一致を検査。
- キーごとに横幅px、最大行数を編集。Canvas `measureText` に基づく推定行数、枠超過、テキストプレビューを計算。
- 検索・警告フィルタ、訳文直接編集、擬似文字列増量（0〜150%）と変数保護。
- 修正済み訳文JSON、疑似翻訳JSON、検査CSV、設定バックアップJSONをダウンロード。端末内 `localStorage` に自動保存。デモ復元。
- HTML/CSS/JSを単一HTMLに同梱。ネットワーク通信、解析SDK、外部フォントなし。

## 実行・検証
- `node --test engine.test.cjs`：**23/23 合格**（JSON検証、変数、疑似翻訳、幅判定、CSV式注入対策など）。
- `python browser_test.py`：**29/29 合格**（Playwright + Chromium、画面編集・フィルタ・エクスポート・端末保存模擬・390pxモバイル表示）。
- Chromium環境では `file://` ナビゲーションが管理者設定で遮断されたため、**同一 `index.html` を Playwright の `set_content()` でロード**し、`localStorage` をテスト内メモリオブジェクトで模擬。通常ブラウザでの `file://` 直接起動と保存永続性は未検証。

## 制約・安全
- 実際のUIで使うフォント・カーニング・CSS余白・禁則処理とは異なることがあり、ここで「OK」でも本番画面で必ず収まる保証はない。計測は文字幅による**推定行数**で、UIの実寸を解析していない。
- ICU plural/select、HTMLリッチテキスト、ネストしたJSON、YAML/ARBには未対応。疑似翻訳は自然言語翻訳ではない。
- 入力はブラウザ内のみで処理する。`localStorage` に入力内容が残るため、公開・共有PCではデモ復元またはブラウザのサイトデータ消去を推奨。機密情報を入力しないこと。

ライセンス: MIT（`LICENSE`）。GitHub保存先: `hourly-app-lab/apps/2026-11-19-mojigako/`（書込成否は実行結果に依存）。
