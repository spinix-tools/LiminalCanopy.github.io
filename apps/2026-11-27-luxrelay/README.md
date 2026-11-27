# LuxRelay / 展示光量割付

2026-11-27 MVP。`index.html` をブラウザで開く。依存ライブラリ・通信・登録なし。作品IDは匿名の英数字を使う。

## ターゲット・選定理由
小規模美術館、資料館、大学展示室、貸出展示の担当者。国内ではパナソニックが展示照度と年間露光量の調整を案内し、海外ではCanadian Conservation Instituteが繊維の光損傷は累積的・不可逆と説明している。計測器や照度計算は既にあるため、複数作品の入替計画に焦点を絞った。需要・売上・利用者数は未検証。

## 競合・差別化仮説
ToolFoundryは単一作品の積算照度計算、fibubは単一作品の複数期間計画、MuseumLuxは記録・予算管理を提供。LuxRelayは複数作品と異なる展示枠の適合グラフから、固定割付を維持して成立する枠数を最大化する。既存競合の全機能・全製品は未調査。前回のAcousticPairなどとは目的・機構が異なる。専用ブランチの差分300ファイル（51アプリディレクトリ）と7キーワードのコミット検索を確認したが、全ソースは未照合。

## 使い方と制約
作品: ID,予算(lx·h),使用済み(lx·h),照度上限(lx)。枠: ID,開館照度(lx),開館合計時間(h),閉館照度(lx),閉館合計時間(h),固定作品ID(任意)。各100行まで。IDは英数字・_・-。数値は小数2桁まで。1枠1作品、1作品最大1枠、枠は重複しない前提。光量は各照度×時間の和。照度上限と残予算を両方検査し、固定割付を除いた二部グラフで増加路を探索する。最適性は割付枠数のみ。複数解の総光量や公平性は最適化しない。設定値は架空のサンプルで安全基準ではない。UV・スペクトル・実測誤差・実展示は未評価。予算内でも保存安全性を保証しない。

## 検証
`node test.cjs`：固定9件、独立全列挙とのランダム500件比較が合格。`python browser_test.py`：Chromiumで初期3/3（単純割付2/3）、固定割付、実現不能検出、編集後の旧結果無効化、JSON実ダウンロード、390px幅、リセット、JS例外0・HTTP要求0を確認。環境でfile URLが拒否されたため同一HTMLをset_contentで検証。実印刷は未検証。

## 調査リンク（2026-11-27）
- https://www2.panasonic.biz/jp/lighting/plam/manual/plan/museum/
- https://www.canada.ca/en/conservation-institute/services/conservation-preservation-publications/canadian-conservation-institute-notes/textiles-environment.html
- https://www.toolfoundry.app/government/museum-lux-hours-calculator
- https://www.fibub.com/science/light-exposure-budget/
- https://apps.apple.com/ca/app/museumlux-art-light-tracker/id6824129800
