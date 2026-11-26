# LuxRelay / 展示光量リレー

2026-11-26 MVP。`index.html` をブラウザで開く。外部ライブラリ・通信・アカウント不要。

## 対象・選定理由
小規模博物館、美術館、資料室の展示担当者。国内の照明設計資料は展示時間と年間露光量の調整を取り上げ、海外では積算照度計算サービスが存在する。需要の存在を示す定性的根拠であり、利用者数・売上・検索量は未検証。

- 国内: Panasonic https://www2.panasonic.biz/jp/lighting/plam/manual/plan/museum/ 、東京国立博物館の研究者による解説（2023） https://www.jstage.jst.go.jp/article/mls/35/2/35_36/_article/-char/ja
- 海外: National Gallery https://national-gallery.github.io/Lux-Allowance-Calculator/about.html （展示・非公開時間の光量計算）、ToolFoundry https://www.toolfoundry.app/government/museum-lux-hours-calculator （単一展示品の積算照度）、fibub https://www.fibub.com/science/light-exposure-budget/ （単一資料の複数期間）、USCalc https://uscalculators.com/conservation/lux-hour-light-fading-calculator/ （回転展示スケジュール）。確認日 2026-11-26。
- 差別化仮説: 単一資料の露光計算ではなく、複数資料を単一展示枠の時系列期間に割り当て、個別の累積予算・照度上限・利用可能期間を同時に満たす。競合の全機能を網羅した比較ではない。検索語候補: 展示 積算照度 計算、museum exhibition light budget rotation planner。
- 重複確認: 会話内の直近10案、mainとの比較で取得できた300ファイル（51アプリディレクトリ）、GitHubコミット検索 lux / 照度 / 展示 / 光曝露 / LightBudget（該当なし）。全既存コードの照合は未実施。

## 機能・モデル
最大6資料・8期間、整数入力。各期間の公開照度×公開時間＋非公開照度×非公開時間を加算。資料別の使用済み予算、ピーク照度上限、期間適合条件を制約とする。公開時間最大→異なる展示資料数最大→設置回数最小の辞書式探索。空き期間は選択可、同じ資料の連続展示は1設置。50万ノード上限では暫定案と表示。先着順比較・予算台帳・候補一覧・JSON保存・印刷。サンプルは先着順200h、最適400h（B→A→C）。数値は架空であり保存基準ではない。

## テスト結果
- `node test.cjs`: 固定11アサーション、独立全列挙300ケース、最大サイズ（50万ノード、暫定表示）合格。
- `python browser_test.py`: Python Playwright と `/usr/bin/chromium` で同一HTMLをインライン読み込み。サンプル、JSON実ダウンロード、不正入力、入力変更での結果無効化、文字列表示、リセット、390px幅、外部HTTP要求・JS例外0件。file:// は環境ポリシーで拒否されたため未検証。
- 未検証: 実展示、実印刷、他ブラウザ、保存科学上の妥当性、実需要・収益性。期間は非重複・時系列と仮定。光源スペクトル、UV、温湿度、実日付、暗所の露光、設営・移動時間は別途評価。保存担当者の承認なしに実物へ適用しない。安全性・劣化予測を保証しない。
