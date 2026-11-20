# 刷り分けグラフ / SURIWAKE GRAPH

制作日: **2026-11-21（JST）** / 種別: 日本語・静的WebアプリMVP / MIT License

## ターゲット・選定理由
学校の配布物、町内会の会報、自治体やNPOの報告書を作る担当者。グラフがカラー画面では見えても、白黒コピー・低品質印刷・色覚の違いによって系列を見失う問題を軽減する。東京都は**2025-03-31**に「TOKYOユニバーサルデザインガイドライン（視覚情報版）」を公表し、印刷物での色以外の工夫（文字や記号の併用等）を推奨している。海外のW3C WCAG 2.2の1.4.1「色の使用」は、色を唯一の情報伝達手段にしないことを定める。これらは課題の実在性を示すが、**アプリの市場規模、ヒット率、支払意思を直接示すものではない**。

## 国内・海外競合と差別化仮説
- 国内：[東京都ガイドライン](https://www.metro.tokyo.lg.jp/information/press/2025/03/2025033137)は制作上の指針。GitHub上の過去作「[色あいだ](https://github.com/spinix-tools/LiminalCanopy.github.io/tree/hourly-app-lab/apps/2026-11-18-iroaida)」は**Webページの文字色・背景色のチェック**（今回とは別用途）。
- 海外：[Datawrapper](https://www.datawrapper.de/docs/automatic-colorblind-check)はグラフの色覚チェックを既に提供し、[Adobe Color](https://color.adobe.com/create/color-accessibility)は配色シミュレーション、[Color Oracle](https://colororacle.org/index.html)は画面全体のシミュレーションを提供する。汎用チャート作成サービスも多数ある。
- **差別化仮説**：ブラウザ上の表を編集するだけで、日本語の印刷物向けに**白黒・模様・値ラベル・数値表をセット**で生成し、SVGとCSVを登録不要・オフラインで渡せる小型ツールには、色覚シミュレーションやデザイン一般ツールと異なる価値がある。競合より優れているとは断定しない。

## 実装したMVP

- 最大**16項目 × 6系列**の編集、項目・系列の追加削除、並列／積上げ棒グラフの切替。
- **6種の識別模様**と値ラベル、白黒／カラーの切替、項目名・出典注記・凡例を含む**SVG出力**、印刷／PDF保存（ブラウザ印刷）。
- 数値表の併記、**CSV読込・CSV書出**、JSONバックアップ・復元、ブラウザ内自動保存。
- 入力の有限性・値域・項目数の検証、重複名・ゼロ値・積上げの小区間の警告。SVG／HTMLエスケープ、CSV式セルのエスケープ。
- 外部API、CDN、ユーザー登録、課金、サーバー側保存、分析タグなし。**入力データは外部へ送らない**。

## 起動・実行

同じフォルダの`index.html`を開く。インストール／ビルド不要。CSVは**UTF-8（BOM可）**のみサポートし、1列目を「項目」、2列目以降を系列名とする。0以上の数値（小数4桁まで）を使う。CSVをExcel等で保存する場合、UTF-8 CSVを選ぶ。

## 検証（2026-11-21）

- `node --test engine.test.cjs`: **43/43合格**（うち**400件の乱数生成データ**でCSV往復・SVG構造・模様数を検証）。
- `python browser_test.py`: **35/35合格**。データ編集、モード変更、入力エラー、XSS非実行、SVG/CSV/JSON出力、CSV/JSON取込、追加削除、画面幅390pxでの水平はみ出し防止を確認。`desktop.png`／`mobile.png`に画面を保存。
- `node --check engine.js`、`node --check app.js`: 合格。ZIP整合性は同梱アーカイブについて別途確認。

**テスト制限**：管理環境で`file://`直接遷移が制限されたため、Chromiumは**同じソースをページ内に展開**して検証。ブラウザの実際のファイル直接起動、端末保存の永続性、実機印刷色・SVGを別アプリで開いた場合の見え方は未検証。SVG模様が実際のプリンターで潰れないこと、WCAG/JISへの全面適合は保証しない。積上げ棒の細い区間には数値が表示されない場合があるため、必ず数値表を併用。最終配布前に原寸試し刷り・人手確認が必要。

## 参考資料（2026-11-21確認）

1. 東京都（2025-03-31）[「TOKYOユニバーサルデザインガイドライン（視覚情報版）」](https://www.metro.tokyo.lg.jp/information/press/2025/03/2025033137)
2. W3C [Web Content Accessibility Guidelines 2.2 – 1.4.1 Use of Color](https://www.w3.org/TR/wcag/)
3. W3C / WAIC [1.4.11 非テキストのコントラスト](https://waic.jp/translations/WCAG22/Understanding//non-text-contrast)
4. [Datawrapper自動色覚チェック](https://www.datawrapper.de/docs/automatic-colorblind-check)
5. [Adobe Color色覚アクセシビリティ](https://color.adobe.com/create/color-accessibility)
6. [Color Oracle](https://colororacle.org/index.html)

リポジトリ保存先（希望）：`spinix-tools/LiminalCanopy.github.io` の `hourly-app-lab` ブランチ、`apps/2026-11-21-suriwake-graph/`。`main`は更新しない。
