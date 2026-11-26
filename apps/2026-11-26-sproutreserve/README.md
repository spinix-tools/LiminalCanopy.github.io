# 芽枠 / SproutReserve
2026-11-26 · 家庭菜園の余り種を使ったセルトレイ播種計画。Open `index.html` in a browser; no backend or dependencies.

## 対象・市場・選定理由
家庭菜園、学校菜園、小規模育苗、種の交換活動。限られた種・セルで目標数の発芽済みセルを得たい人向け。
- 日本：JAあつぎの余り種保存解説（2022年11月） https://www.ja-atsugi.or.jp/learn/garden/kateisaien/2022/11.html 、タキイのセルトレイ育苗解説 https://www.takii.co.jp/tsk/y_garden/autumnsummer/point03/index.html 。農研機構の種子寿命研究（2020-11-18） https://www.naro.go.jp/publicity_report/press/laboratory/ngrc/137426.html
- 海外：University of Alaska Fairbanks の家庭発芽試験 https://www.uaf.edu/ces/publications/database/gardening/procedures-wet-towel-germ.php
- 競合：CalcBase https://calcbase.in/calculator/germination-rate-calculator 、Plant Calculator https://plant-calculator.com/seed-germination-calculator は主に発芽率・播種量。ISTA https://www.seedtest.org/en/services-header/tools/germination-committee/germination-toolbox.html は試験の信頼区間等。BioExplorer https://www.bioexplorer.net/seed-germination-calculator は信頼区間と播種量も扱う。
- 差別化仮説：平均発芽本数でなく、目標数以上のセルに1粒以上発芽する確率を条件とし、種の残数・セル数・セル当たり上限を満たす最少粒数を求める。検索流入（古い種・発芽率・育苗トレイ）と再利用を狙う。市場規模・課金意向・独占性は未検証。
- 重複確認：直近の会話履歴、mainとの差分先頭300ファイル（51アプリディレクトリ）、germination/発芽/seed/播種 のコミット検索（0件）。全既存ソースは未精査。

## 実装
試験数1–10000、セル1–288、残数0–2880、最大10粒/セル。観測率または95%両側Wilson区間の下端を設計率として選択。固定粒数では均等配分が最適：2セルの合計粒数を保つと1セル以上成功の確率は不変で、両方成功の確率は均等化で増加する。従って任意の目標セル数で均等化は不利にならない。成功セル数の分布を目標以上を吸収状態とするDPで求め、単調性を使い二分探索。未達なら上限での参考案を表示。CSV、印刷、モバイル表示。

## 検証
- `node test.cjs`：固定11件、独立全列挙720条件（最大5セル、4発芽率）全合格。288セル境界も確認。
- `python browser_test.py`：Playwright + Chromium（/usr/bin/chromium）。モード変更、旧結果無効化、CSV 24行と合計50粒、エラー、リセット、390px幅、JS例外/外部HTTP要求ゼロ。file://は環境でブロックされたためHTMLインライン読み込みで合格。
- 初期例：20粒中14粒発芽、24セル中20セル以上、残60粒、上限3、目標95%。観測率なら最少50粒・95.27%、Wilson下限48.10%なら60粒でも43.58%で未達。

## 限界
独立・同一発芽確率を仮定。相関、病害、温湿度、間引き、移植後生存、休眠、試験と実栽培の差はモデル外。Wilson下限は別シナリオであり総合保証ではない。実栽培・実需要・収益性は未検証。商業認証用途ではない。入力はブラウザ内のみ、通信・登録・追加API費用なし。
