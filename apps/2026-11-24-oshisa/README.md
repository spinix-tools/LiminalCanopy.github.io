# 押し差 / OSHISA — ADCボタン衝突チェッカー
2026-11-24制作。index.htmlをブラウザで開くだけ。外部API・サーバー・アカウント不要。

## 対象・選定理由
Arduino等の電子工作愛好者、電子工作教室、小規模試作担当。抵抗分圧で入力ピン不足を補うと、同時押下や抵抗誤差でADC値が重なる。[Maker Faire Tokyo 2026](https://www.impress.co.jp/newsrelease/2026/08/20260807-02.html)は2026-08-07時点で約280組の出展者・スポンサーを予定、世界200都市以上に展開。[主催者の9月7日報告](https://makezine.jp/event/mft2026/)で開催を確認。海外の[EDN記事](https://www.edn.com/read-multiple-switches-using-adc/)も同時押しの設計課題を扱う。直接需要・収益性は未検証。

## 競合・差別化仮説（2026-11-24）
国内：[t-hom VBA抵抗選定](https://thom.hateblo.jp/entry/2023/03/11/211817)、[しなぷす](https://synapse.kyoto/tips/ResDiv/page001.html)。海外：[AceButton](https://github.com/bxparks/AceButton/blob/develop/docs/resistor_ladder/README.md)、[EDN設計表](https://www.edn.com/read-multiple-switches-using-adc/)、[ECAD Workbench](https://ecadworkbench.com/calculators/voltage-divider/)。同時押しの検査・抵抗選定は既存技術。**手持ちの異なる抵抗候補から全押下状態の保守的ADC区間を分離する組合せ探索、曖昧値を拒否する判定コード出力を一画面で提供**する点が仮説。既存アプリ一覧と電源関連等7件のREADMEを確認したが、全ソースの重複検査は未実施。

## 実装
- 2〜5ボタンの全4〜32状態、8〜16bit ADC、抵抗誤差・追加ADC誤差を設定。
- 手持ちの異なる抵抗値最大16個から最大4,368組を全探索。最小の符号付き空きコード数を最大化し同点では重複ペアを最小化。
- 区間の図示、重複相手、ADC入力の模擬判定、CSVとC/C++判定関数ヘッダー出力、印刷。
- 初期例：495組探索、重複ペア8→1、最小空き−5→−2。重複は解消していない。

## モデル・制限
Vcc=Vref、RpからADCノードをプルアップ、各スイッチと抵抗を個別にGNDへ接続。G=押下枝の1/Rの和、理想ADC値 M/(1+Rp*G)、M=2^bits−1。独立した同一相対許容差での単調性による端点計算、外向き整数丸めと追加誤差。空きコード数=max(low1,low2)−min(high1,high2)−1、負数は重複幅。ADC入力負荷、基準電圧差、温度、過渡、チャタリング、異なる許容差、同値抵抗の複数使用探索は未対応。低電圧学習・試作専用、安全関連用途不可。実機の仕様確認・実測・デバウンスが必要。生成関数は静的な区間判定のみ。

## 検証
- Node.js：固定8件、ランダム300回路・200,544端点×状態の照合、独立ビットマスク列挙による最適化100件、全合格。
- Chromium：初期表示、探索、判定、CSV・ヘッダー出力、入力変更時の無効化、重複、入力エラー、リセット、390px表示を確認。JS例外・外部HTTP要求0件。環境の制約でfile://ではなく同一HTMLのインライン実行。
- 実機・生成C/C++のコンパイル未検証。追加OpenAI API課金、有料サービス、個人情報収集なし。
