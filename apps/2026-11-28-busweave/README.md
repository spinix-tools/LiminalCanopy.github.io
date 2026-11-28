# BusWeave / I²C アドレス割付 v1.0

2026-11-28。`index.html` をブラウザで開く。依存ライブラリ、登録、外部API不要。架空の機器例を編集して計算し、JSONを保存できる。

## ターゲット・選定理由
Arduino/ESP32利用者、電子工作教材、小規模組込み設計者。国内のCHIRIMEN教材と海外のAdafruit教材にアドレス衝突の解説があり、設計前の検査需要を示唆する。TI I2C Designerは自動ツリー生成を含む強い競合。Embedded Nerdにも代替アドレス探索ツールがある。差別化仮説は、任意の候補を手入力し、固定上流機器とMUX自身の衝突を排除しつつ、チャネル数・設定変更数の辞書式最適解を簡単に得られること。市場規模、利用者数、収益性は未検証。

- 国内: https://chirimen.org/ty51822r3/section3
- 海外: https://learn.adafruit.com/working-with-i2c-devices/address-conflicts
- 競合: https://www.ti.com/tool/I2C-DESIGNER
- 競合: https://embeddednerd.com/tools/i2c-address-lookup/ （2026-08-25の開発者投稿も参照: https://www.reddit.com/r/ArduinoProjects/comments/1vyftef/i_built_a_free_i2c_address_compatibility_checker/ ）

## 実装・制約
最大40台。1行に機器名, 既定アドレス, 代替アドレス…を入力（7bit、16進2桁）。直接接続を優先し、不可能なら単一MUX・排他的な1チャネル有効化を前提に、最少チャネル数→最少既定値変更を最小費用最大流で求める。各アドレスの容量はチャネル数。上流固定アドレスとMUX自身を下流から除外。MUX使用時は割付対象全台が下流、固定機器のみ上流。全台不可能な場合は最大割付の一例を表示する（未完成）。チャネルマスク・JSON出力あり。電気的条件、初期化手順、10bit、複数MUX、同時複数チャネル、機器固有の複数アドレス応答は未対応。実機動作を保証しない。

## テスト
`node test.cjs`：独立全列挙400ケース、固定8グループ、40台ケース合格。サンプル6台は2チャネル、既定値変更1台、MUX 0x71。
`python test_browser.py`：Chromiumでサンプル、JSON実ダウンロード、旧結果無効化、解なし、不正入力、安全な文字表示、390px幅を確認。JS例外・外部HTTP要求0。環境のfile://制限により同一HTMLのインライン読み込みを使用。実機・他ブラウザは未検証。

## 重複確認
専用ブランチの既存291項目名、I2C・address multiplexerのコミット検索、直近の制作履歴を確認。明確な重複は見つからなかったが、全既存ソースの網羅照合は未実施。
