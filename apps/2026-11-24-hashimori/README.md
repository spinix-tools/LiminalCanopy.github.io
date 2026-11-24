# 橋守 / HASHIMORI
2026-11-24 — ステンシル型紙の孤立と単一点破損を検査する、ブラウザ完結MVP。

## 対象・選定理由
ステンシルを手切り・クラフトカッターで作るDIY愛好者、工房、教材制作者。国内では[ブラザーのステンシル制作例（2018年5月号）](https://www.brother.co.jp/product/cuttingmachine/magazine/kiji001/index.aspx)と[ScanNCut機能](https://www.brother.co.jp/product/cuttingmachine/cm300/feature/index.aspx)が利用場面を示す。海外では[Cricut 2026年Q3決算](https://investor.cricut.com/news-releases/news-release-details/cricut-inc-reports-third-quarter-2026-financial-results/)の2026年9月30日時点のアクティブユーザーは598.9万人。これはクラフト全般の数字であり、ステンシル需要の直接推計ではない。

## 競合・差別化仮説（2026-11-24確認）
国内のCanvasWorkspace/ScanNCutは図案作成・加工を支援。海外の[Makerfern](https://makerfern.com/stencil-maker)、[Maker3C](https://maker3c.com/features/stencil-bridges/)、[Stencil Lab](https://stencil-lab.com/)は自動橋追加・孤立検査などを提供する。自動追加自体は既存機能。本MVPは、固定外周につながる素材の単一セル除去で新規脱落する面積を数え、破損位置・影響を見える化し、孤立と弱点の改善を別々に比較する検査に特化する。競合優位性・有料需要は未検証。次は10件の実図案で破損箇所の発見時間と修正後の実物結果を比較したい。

## 起動・操作
index.htmlをブラウザで開く。30×22マスの編集、PNG/JPEGの粗い縮小取り込み、文字グリッド、破損シミュレーション、直線橋候補の表示・適用、Undo、端末保存・復元、実寸指定の印刷用SVG。外部ライブラリ・API・アカウント不要。画像は端末内で処理する。

## 計算・検証
固定外周と4近傍のグラフに対するDFS low-linkで、連結済み素材の各内側セルを1つ除去した際に新たに脱落するセル数を計算。水平/垂直の連続した切り抜きセルを素材に戻す候補を最大12セルまで列挙し、孤立セル数・弱点数・最大脱落・追加セル数の辞書式順序で上位5件を表示。複数橋の同時大域最適化ではない。
- `node test.cjs`：固定アサーションと120ランダム図案、独立BFSによる31,489箇所の破損照合が合格。サンプルは改善案を順次適用して孤立32→0、弱点5→0、最大脱落35→0。
- `python browser_test.py`：Chromiumで破損、候補表示・適用、模擬保存復元、Undo、SVG、入力エラー、PNG取り込み、390px表示を確認。JS例外・外部HTTP要求0件。環境のURL制限によりHTMLインライン実行・localStorage模擬。
- 専用ブランチの既存191ディレクトリ名と関連7件のREADMEを確認。全実装との比較は未実施。

## 限界
単一セル除去のみ。固定外周、4近傍、粗いグリッドのモデル内の幾何診断であり、物理強度、複数箇所の破損、刃幅、素材安全性は判定しない。SVGは印刷用塗りつぶし図案で、機械加工用カットパスではない。実際の切断・耐久性、永続保存、利用需要は未検証。
