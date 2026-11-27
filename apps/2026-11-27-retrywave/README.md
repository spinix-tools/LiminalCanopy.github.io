# RetryWave — リトライ回復実験室

2026-11-27 / MVP。index.html をブラウザで開く。外部ライブラリ・登録・通信不要。

## 対象と選定理由
日本・海外のAPI開発者、SRE、技術研修担当。AWSの日本語技術資料は再試行集中とジッターを解説しており、海外には待機時間計算や集中の可視化ツールが存在する。需要の兆候であり、市場規模や収益性は未検証。
- AWS: https://aws.amazon.com/jp/builders-library/timeouts-retries-and-backoff-with-jitter/
- retries.dev: https://retries.dev/ （待機時間）
- Integronauts: https://www.integronauts.com/tools/retry-simulator （期限・多層再試行）
- Jitterflow: https://jitterflow.io/tools/backoff-calculator/ （同時クライアントの集中）

## 差別化仮説
同一の障害期間、復旧後の受付容量、期限、シードで2方針を比較し、集中による容量超過失敗と期限内の成功数を一緒に示す。単なる待機時間計算との差。競合全数や独占性は未確認。直近の制作履歴・mainとの差分51ディレクトリ・retry/backoff/再試行/リトライのコミット検索で明確な重複なし（全履歴の網羅照合ではない）。

## 機能・モデル
最大2000クライアント、20試行、300枠（100ms/枠）。全員時刻0開始、各試行は1枠で完了。復旧前は全失敗、復旧後は枠ごとの容量を超えた試行が失敗。待機は2倍の指数バックオフ、なし/full/equal jitter。期限内完了可能な試行のみ実施。同枠の競合順はシードで決定。終了理由は試行上限優先。成功者のみのP95、再試行ピーク、全時系列を表示、JSON保存。実APIに接続しない。キュー、サーバの内生的回復、冪等性、実測負荷は対象外。

## 検証
- `node test.cjs`：固定8件、独立したジッターなし集団計算500件、3方式の不変条件1500件、最大条件の検査に合格。
- `python browser_test.py`：Chromiumで初期表示、入力変更、再計算、不正入力、リセット、JSON保存、390px幅、JS例外・HTTP要求なしを確認。環境制限でfile://が拒否されたため同一HTMLをインライン読み込み。Python PlaywrightとChromiumが必要（既存環境使用）。
- 初期例（120クライアント、1秒の障害、12件/100ms、6秒期限、seed 42）：A/Bの成功36/119、再試行444/351、ピーク120/34。仮想条件内の値であり一般的優位性は保証しない。

追加API課金・有料サービス・個人情報収集なし。
