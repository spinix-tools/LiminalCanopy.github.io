# とどく字 / TODOKUJI

**見る距離から紙の案内板を設計・点検し、原寸SVGとして書き出す、登録不要・完全ローカルのWebアプリ。**

## 対象と選定理由

対象は地域施設、小規模店舗、学園祭、公共イベントなどで、自分で受付案内・誘導サインを作る非デザイナー。内閣府「令和8年版高齢社会白書」では日本の2025年10月1日現在の高齢化率が29.4%。見え方の個人差に配慮するニーズがありうる。ただし高齢化率から本アプリの利用意欲や購買率は推定できない。

海外の看板制作ガイドでも、実際の視距離に合わせて文字高を決め、原寸で確認することが重要とされる。今回の選定理由は、単なる色差チェッカーだけでは「2.5m先から読める紙の案内」が完成しないという作業上のギャップ。

## 競合と差別化仮説

- 国内向け: [Adobe Color（日本語・色覚シミュレーター）](https://color.adobe.com/jp/create/color-accessibility) / [Adobeのコントラスト確認](https://color.adobe.com/jp/create/color-contrast-analyzer)。配色・色覚確認機能が充実。
- 海外: [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) はWCAG色差評価、[Fengo Distance Legibility Calculator](https://fengo.pl/en/agencja/narzedzia/czytelnosc-z-odleglosci) は視距離から字の大きさを見積もる。
- **差別化仮説:** 日本語の案内文編集・見る距離・色差・紙面の重なり検査・原寸SVG出力を、1画面で無料・登録不要・完全オフラインでまとめる。各機能自体は既存競合が存在し、独占的な新規性を主張しない。

## 実装機能

- 受付/会場/順番待ちの3プリセットと、見出し・補足・フッター・矢印の編集。
- A4/A3・縦横、文字サイズ（mm）、想定視距離（m）、4色の個別編集。
- SVG原寸のリアルタイム表示、白黒印刷プレビュー。
- 見出し・補足文の推定視距離、WCAG色差比の参考値、折返し・重なり・配色の警告。
- 文字色自動改善、SVGダウンロード、診断TXT、再編集JSON出力/読込、端末内自動保存（利用可能時）。
- ビルド不要・外部通信なし・広告/解析/外部フォント/APIなし。ユーザーの入力を送信しない。

## 実行・テスト

`index.html` をブラウザで開く。`engine.js`, `app.js`, `style.css` を同じフォルダに置く。追加ライブラリ不要。

- Node.js v22 `node --test engine.test.cjs`: **40/40 合格**。
- Chromium + Playwright `python browser_test.py`: **39/39 操作検証合格**。プリセット、ライブ編集、SVGの有効XML・実寸、配色自動調整、警告、JSON入出力、TXT保存、モバイル横はみ出し、JavaScript例外を検査。
- 本実行環境では `file://` への直接遷移が `ERR_BLOCKED_BY_ADMINISTRATOR` となるため、**同一HTML・CSS・JSをインライン化したページでブラウザ操作試験**を実施。通常ブラウザの直接起動、印刷実機での縮尺、保存の再起動後持続性は未検証。

## 数値の取り扱いと制限

- 視距離は看板実務の目安（目立つ文字高 25mm/3m、補足はその半分）を使用。**字高 = フォントサイズ×0.70**という簡易仮定を置いており、実際の日本語フォントの字高は測定していない。視認性の保証値ではない。
- コントラストはW3Cの相対輝度とWCAG通常文字4.5:1を**参考指標**として表示。WCAGのコントラスト規定はWeb向けであり、印刷物の規格認証を意味しない。
- 改行幅は文字種ごとの近似値、重なりは簡易幾何判定。出力SVGのフォントは閲覧・印刷環境に依存する。色のみで意味を伝えず、原寸試し刷りを必ず行う。
- フォントの縦方向の実測、用紙余白、照明、印刷色、視覚特性、印刷会社指定の入稿規則には対応していない。安全誘導等に使用する際は専門家・現地で別途検証が必要。

## 調査資料（確認日: 2026-11-18）

1. [内閣府「令和8年版高齢社会白書」2025年10月時点、65歳以上29.4%](https://www8.cao.go.jp/kourei/whitepaper/w-2026/html/gaiyou/s1_1.html)
2. [W3C WCAG 1.4.3: Contrast Minimum, normal 4.5:1 / large 3:1](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
3. [Manchester Printed, 2026-10-01, 25mm/3mの看板実務経験則](https://manchesterprinted.co.uk/help/sign-letter-height-viewing-distance/)
4. [Adobe Color: 色覚とコントラストの現行機能](https://color.adobe.com/jp/create/color-accessibility)
5. [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
6. [Fengo: Sign Distance Legibility Calculator](https://fengo.pl/en/agencja/narzedzia/czytelnosc-z-odleglosci)

## 利用と権利

MIT License。追加API費用・外部サービス・秘密情報・個人情報収集なし。市場性、使用時間削減、アクセシビリティ改善率、販売可能性は実ユーザーの試験で検証が必要。