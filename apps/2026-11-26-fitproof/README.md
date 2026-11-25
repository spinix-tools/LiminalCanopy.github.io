# 寸証 / FitProof — 2026-11-26

対象：FDM 3Dプリント利用者、試作工房、メイカースペース。穴径・軸径などを同じ造形条件で測定し、単なる補正値ではなく補正モデルの妥当性を検討する。index.html をブラウザで開く（外部依存なし）。初期値は架空データ。CSV/TSV形式で CAD寸法,実測寸法,fit または check を入力する。80行まで、fitは異なる寸法3種以上。別の試作の測定値は check にする。

## 需要・競合（2026-11-26調査）
- 日本：Maker Faire Tokyo 2025 は260組の出展を告知。3Dプリンターを含むデジタル製造のコミュニティがある。https://www.impress.co.jp/newsrelease/2025/09/20250908-02.html
- 国内競合：Yuki Digital Lab のBambu向け補正計算機は実測平均・ばらつき・片側補正を算出。https://yukidigitallab.com/tools/bambu-xy-dimension-compensation-calculator/
- 海外：OrcaSlicer は寸法許容差試験モデルと収縮・穴・外形補正を提供。https://github.com/OrcaSlicer/OrcaSlicer/wiki/tolerance-calib/79a2b8083c01c18f0abc2c656bdb54541429e357
- 海外競合：Wired White は最小二乗で収縮・輪郭・穴の誤差を分離する計算器。https://wiredwhite.com/calcs/3d-print-tolerance-calculator-slicer-settings-cad-fits/
- 差別化仮説：一定差・比例・アフィンの3モデルを寸法単位の交差検証で比較し、学習に使わない別試験と外挿警告を一画面に統合。再試作を判断する補助に特化。類似機能の不存在、利用需要・売上は未検証。無料公開後、同条件の試作で補正前後の誤差と再試作回数を比較するのが次の検証。

## 方法・制限
最小二乗で y=a*x+b を推定。CAD寸法ごとに全測定行を除外する交差検証で各寸法の平均二乗誤差を均等に集計。最小RMSEのモデルを選び (目標-b)/a を求める。範囲外は値を画面に表示しない。checkは選択・推定に未使用。範囲内checkがすべて許容内なら、その観測点のみ許容内と表示する。予測区間ではなく、目標寸法の適合・物理的嵌合・強度は保証しない。造形条件を混ぜないこと。API・サーバー・個人情報収集なし。実機試験未実施。

## テスト
- `node test.cjs`：12/12合格（モデル回復、逆算、別試験判定、外挿、入力、データ分離、80行）。
- `python browser_test.py`：Chromiumで初期表示、JSONダウンロード、旧結果無効化、外挿、不正入力、別試験不合格、リセット、390px幅、JS例外・HTTP要求ゼロを確認。環境のfile URL制限によりインライン読み込み。Python PlaywrightとChromiumが必要（アプリ自体には不要）。
- 初期例：目標15 mm、推定CAD 15.447 mm、CV RMSE 0.026 mm、別試験残差 +0.010 mm（許容±0.08 mm）。架空データであり性能実証ではない。
