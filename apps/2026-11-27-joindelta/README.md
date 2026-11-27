# JoinDelta — 結合前の集計監査

2026-11-27 / MVP / 日本語UI。`index.html` をブラウザで開くだけ。登録・サーバー・外部依存なし。

## 対象と選定理由
EC・在庫・商品マスターを扱う小規模事業者、Excel/Power Query利用者、データ品質担当者。商品コードの全角半角や大小文字を統一する際、照合率が上がっても多重一致によって数量・金額の集計が変わる可能性がある。
- 日本：Microsoftの製品・売上データ結合例 https://support.microsoft.com/ja-jp/excel/learn-to-combine-multiple-data-sources-power-query 、重複処理 https://learn.microsoft.com/ja-jp/power-query/working-with-duplicates
- 海外：dplyrの多対多警告 https://dplyr.tidyverse.org/reference/mutate-joins.html 、競合 https://data.sparkpond.com/join-csv/ 、 https://a2z.tools/csv-join-merge-planner 、 https://mysafeinfo.com/tools/csv-join
- 競合にも行数予測・重複警告・キー正規化がある。差別化仮説は、結合実行ではなく完全一致から提案ルールへの追加/消失一致ペアと整数集計差を明細単位で監査すること。日本語の全角半角にも対応。市場規模、独占性、支払意思は未検証。

## 操作
左にヘッダーなしのキー＋整数値（2列TSV）、右にキーのみ（1行1件）を貼る。各10000行・200万文字まで。整数は符号付き15桁以内。引用符で囲むTSV、埋め込み改行・タブは非対応。NFKC→trim→小文字化の各処理を選択し「差分を検査」。空文字キーは不一致、空行は無視。NFKCは幅以外も変更する。左結合と内部結合の行数・合計、追加/消失ペア、複数一致、明細別差分を表示。JSONには全明細を出力（整数集計は精度保持のため文字列）。画面表示は300件まで。実際の結合・名寄せ・原データ修正は行わない。非個人の商品コード等のみを使用。外部通信や永続保存なし。

## 検証
`node test.cjs`：800生成ケースを独立のペア全列挙と照合、固定9アサーション合格。最大10000×10000の一致件数を実体化せず計算し、BigIntの合計を確認。初期例：左結合5→7行、合計950→1250、追加一致3ペア。`python browser_test.py`：Chromiumインライン読み込みでサンプル、JSONダウンロード、入力変更時の結果無効化、不正入力、フィルター、390px幅、クリアを確認。JS例外・外部HTTP要求0件。実業務データ、ブラウザ全種、SQL方言の照合順序、少数値、複合キーは未検証。NFKCによる一致は同一実体を保証しない。

## 重複調査
会話内の既作、mainとhourly-app-labの比較に含まれる51ディレクトリ、join/結合/CSV/cardinalityのコミット検索（該当0件）を確認。全既存ソースの網羅照合は未実施。
