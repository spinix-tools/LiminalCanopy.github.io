# 棚余白 / ShelfSlack

## 対象・選定理由
小規模図書館・学校図書室・資料室向け。請求記号順を維持しながら新着資料を受け入れる際、棚をまたぐ移動量を抑える。日本の棚移動実習・余裕配架の実例と海外の移設計画ツールから課題の存在を確認した（2026-11-26調査）。市場規模・課金意向は未検証。
- 国内: [県立長野図書館](https://www.knowledge.pref.nagano.lg.jp/info/gaiyo/bakusyo.html)、[岐阜女子大学](https://gijodai.jp/jyouhou/info/2022/11/2516)
- 海外競合: [bookshift](https://github.com/distichum/bookshift)（移動先の位置計算）、[ShelfWaypoint](https://apps.apple.com/my/app/shelfwaypoint/id6809995387)（移設計画・カート経路）、[Shelf Fill Calculator](https://buildfigure.org/shelf-fill-and-shifting-calculator)（空き幅と移動負荷の見積もり）。

## 差別化仮説・使い方
移設計画全般ではなく、同じ書架群への新着資料挿入を対象に、既存資料が棚をまたぐ総幅を最小化、同幅なら移動ブロック数を最小化する。順序・分割禁止・棚別余白を制約とし、動的計画法 O(棚数×資料数²) で厳密に解く。左詰めとの差を表示する。index.html をブラウザで開く。棚は幅,余白（mm）、資料はラベル,幅mm,現在の棚番号（新規は0）、目標順に記入。最大40棚・120ブロック。JSON保存・印刷対応。外部通信・依存・アカウント不要。

## 検証
- `node test.cjs`: 独立全列挙400ケース一致、境界・入力・最大サイズ7検査合格。サンプルは左詰め450mm/2件から最適0mm/0件。
- `python browser-test.py`（PlaywrightとChromiumが必要）: HTMLインライン読込（環境でfile URLが禁止）、JSONダウンロード、入力変更による結果無効化、不正・不成立入力、文字列の安全な表示、初期化、390px幅を確認。JS例外/HTTP要求0件。
- 実際の棚移動・現場負担・印刷実機・他ブラウザは未検証。移動幅は作業時間ではない。棚内移動、重量、高さ、仮置き・移動手順は対象外。
- 重複確認: 既存ブランチ差分の300ファイル相当の範囲（51ディレクトリ）と書架・shelf・配架・棚移動・shelfflowのコミット検索（各0件）、直近の制作履歴。全件・全ソースの照合ではない。
