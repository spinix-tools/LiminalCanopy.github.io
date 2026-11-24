# 弦合わせ / GENAWASE
2026-11-25制作。6弦ギターで複数の調弦を使う奏者・講師・リペア担当向けの、交換本数制約付き相対張力プランナー。`index.html` をブラウザで開くだけ。登録・通信・課金・音声収録なし。

## 選定理由・競合（2026-11-25調査）
- 国内：東京商工リサーチ（2025-05-05）によれば楽器店182社の2024年売上高は前年比5.4%増。ギター需要は周辺指標であり、アプリの直接需要ではない。https://www.tsr-net.co.jp/data/detail/1201354_1527.html
- 国内：サウンドハウスにドロップ調弦専用弦がある。https://www.soundhouse.co.jp/products/detail/item/317573/ 。計算ツールズも張力計算を提供。https://ta5k.com/tools/fun/guitar-string-tension
- 海外：Fenderは複数の変則調弦を解説。https://www.fender.com/articles/setup/alternate-guitar-tuning 。D'AddarioとStringjoyは弦別張力計算、Guitar String Tension Calculatorは基準張力との比較やゲージ提案を提供。https://www.daddario.com/pages/string-tension-pro-string-tension-calculator https://stringjoy.com/string-tension-calculator/ https://guitarstringtensioncalculator.com/
- 差別化仮説：一調弦の最適化ではなく、同じ弦セットで基準を含む最大9調弦を横断し、交換本数0〜6本ごとの最悪偏差を同時に比較する。競合の全機能は未調査。実需・優位性・収益性は未検証。

## 機能・モデル
基準調弦からの半音差を6弦→1弦の順で入力。各弦の現行線密度を1とした交換候補を最大4個入力（メーカー公開線密度比または同じ音高・弦長での張力比）。基準調弦は常に評価。相対張力は T/T0 = 線密度比 × 2^(半音差/6)。弦長一定・理想弦モデル。最大5^6=15,625組を全探索し、最大絶対偏差、偏差二乗和、交換本数の順に最小化（浮動小数点許容差1e-10）。希望偏差の達否、各弦・調弦の比較表、CSV、印刷、プリセットを提供。初期候補は架空であり購入推奨ではない。実際の張力・楽器の耐荷重・弦の破断・弾き心地・ゲージ適合は判定しない。

## テスト結果
- `node test.cjs`：固定6アサーション、独立ビットマスク探索との100条件×7予算=700比較すべて合格。架空サンプルは15,625組、最大偏差20.63%→12.00%、3本交換。
- `python browser_test.py`：Chromiumで同一HTMLをインライン実行（環境でfile URLが禁止）。初期表示、予算変更、古い結果の無効化、不正入力、プリセット、CSV、390px幅、JS例外・HTTP要求ゼロを確認。Playwright/Chromiumはテスト時のみ必要。
- 専用ブランチの既存ディレクトリ一覧と関連8件のREADME冒頭を確認。比較範囲に同用途は見つからなかったが全READMEの確認ではない。
