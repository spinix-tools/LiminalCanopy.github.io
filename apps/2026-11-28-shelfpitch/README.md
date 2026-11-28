# ShelfPitch / 可動棚の移動最小化
制作日：2026-11-28。`index.html` をブラウザで開くだけで動作する無料・オフラインMVP。

## 対象・市場・差別化仮説
DIY、収納整理、家具施工の担当者。既存棚に新しい収納物を入れるとき、全棚板を均等に動かすのではなく、必要な棚板だけを移動したいという課題を選定した。
- 国内：[Shelf Planner](https://apps.apple.com/jp/app/shelf-planner-%E6%A3%9A%E6%9D%BF%E5%89%B2%E4%BB%98-32mm/id6808238280) は32mm格子・均等割付・手動調整、[TiGRAN](https://www.tigran.jp/gridshelf/gridplan.html) は収納レイアウトと価格計画を提供。
- 海外：[Ultra Woodworking](https://www.ultrawoodworking.com/tools/shelf-spacing-calculator/) は均等開口と支持穴位置比較、[SawNest](https://sawnest.com/tools/shelf-spacing-calculator) は均等開口と墨付け計算を提供。
- 差別化仮説：段ごとの必要高さ、既存の棚位置、使用不可穴を入力し、移動枚数を最優先、同数なら総移動距離を最小化。実際の作業削減・検索需要・収益性は未検証。競合全体での独自性は保証しない。

## 操作・計算範囲
最大20枚、内寸5000mm、整数mm。内底からの棚板下面支持位置を等間隔の格子として設定。収納物の段順と棚板枚数は固定。全段の必要高さ（取り出し余裕込み）と使用不可位置を指定して計算する。動的計画法で全許可格子位置を評価し、移動枚数→総距離の辞書式最適解を返す。同点は決定的な走査順。前後比較、解なし判定、CSV、印刷を実装。サンプルでは棚板3枚中1枚を32mm上げ、不足段1→0。耐荷重、幅・奥行き、たわみ、転倒防止、金具適合、作業順、穴中心と下面の差は別途確認する。外部通信・登録・API・個人情報収集なし。

## テスト
- `node test.cjs`：固定8件、独立全列挙500ケース合格。
- `python test_browser.py`：Chromium（Playwright、/usr/bin/chromium）で初期値、CSVダウンロード内容、使用不可位置、編集時無効化、解なし、不正入力、初期化、390px表示、JS例外・外部HTTPなしを確認。HTMLをset_contentで読み込み。実機・他ブラウザ・印刷実出力・最大規模性能は未検証。

保存予定先：`hourly-app-lab/apps/2026-11-28-shelfpitch/`。既存mainやサイトを変更しない。
