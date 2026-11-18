# 色あいだ / IROAIDA — GitHub単一HTML版

制作日：2026-11-18。対象：日本語Webページを制作する個人・小規模事業者・地域広報。`index.html`を直接開いて利用できます。外部通信、アカウント登録、追加課金、個人情報収集はありません。

## 背景・差別化仮説
国内：デジタル庁の[2026年3月31日更新の方針](https://www.digital.go.jp/accessibility-statement)は JIS X 8341-3 と WCAG 2.2 に言及。海外：EUの[アクセシビリティ要件](https://europa.eu/youreurope/business/selling-in-eu/selling-goods-services/accessibility/index_en.htm)が対象製品・サービスに2025年6月28日から適用（例外あり）。実際のアプリ需要・収益性を示す数字ではありません。

既存競合：[WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)、[Adobe Colorコントラストチェッカー](https://color.adobe.com/jp/create/color-contrast-analyzer)、[Adobe Color色覚シミュレーター](https://color.adobe.com/jp/create/color-accessibility)。どちらの機能にも先行例があります。

仮説：**実際の日本語LPモックに8色を適用し、4用途の合否、色相を保った文字色補正、色覚の近似表示、CSS/CSV/JSONへの持ち出しをオフライン一画面で行う**用途に需要がある。競争優位・支払意思は未確認。

## GitHub版の機能と検証
8色の編集、4プリセット、4ペアのAA判定（通常文字4.5:1、大きな文字3:1、AAA通常文字7:1）、ペア単位と一括補正、4種の近似シミュレーション、CSS/CSV/JSON書き出し・JSON復元・localStorage。WCAG 2.2の文字色コントラストに関する参考チェックのみ。色覚表示は医療的・厳密な再現ではなく、全体的なWCAG適合の保証もしません。

**検証の区別**：別途配布するフル版ZIPは Node.js 33/33 と Chromium操作34/34 合格。GitHubのこの単一HTML版は**独立実装**であり、同じテスト実績は転用できません。GitHub版についてはソース確認のみ（実機操作未検証）。完全版のリポジトリ同期は未完了。フル版のChromiumはHTML/CSS/JSを直接読み込みlocalStorageのみ模擬（管理ブラウザがすべての直接遷移を制限するため）。実サーバー配信の検証も未実施。

ソースコード MIT License。
