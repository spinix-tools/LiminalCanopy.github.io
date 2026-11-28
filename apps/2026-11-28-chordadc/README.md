# ChordADC — 同時押し監査

## 対象・選定理由
Arduino等の電子工作、少ピンマイコンの入力設計者。国内では抵抗公差とADCのボタン数の限界を検討する実例があり、海外でも1入力で複数ボタンを扱うライブラリや同時押しの相談が存在する。需要の定性的な根拠であり、市場規模・有料化は未検証。

- 国内実例: https://zenn.dev/takebo/articles/analog-buttons
- 海外の設計資料: https://github.com/bxparks/AceButton/blob/develop/docs/resistor_ladder/README.md
- 海外ライブラリ: https://github.com/dxinteractive/AnalogMultiButton
- 同時押しの課題: https://forum.arduino.cc/t/resistor-ladder-pressing-more-than-one-button/327693
- 関連競合: https://www.circuitkitchen.com/voltage-divider-calculator （分圧・公差）

## 差別化仮説
独立並列枝＋プルアップ方式に限定し、未押下を含む最大256状態の公差区間を一括比較する。曖昧コードは拒否するC++デコーダを生成する。通常の分圧計算器や実測値ベースのライブラリを補完する。独自性は機能構成の仮説であり、世界初とは主張しない。

## 起動・モデル
index.htmlをブラウザで開く。外部依存・登録・通信なし。2〜8枝、100〜1,000,000Ω、8/10/12bit、共通許容差0〜20%、追加誤差0〜100コード。電源=ADC基準、独立抵抗公差の理想DCモデル。G=押下枝のコンダクタンス合計、V/Vref=1/(1+Rp*G)、コード=floor(2^bits*V/Vref)を飽和させる。最小・最大は抵抗公差の単調性から算出し、追加誤差を加える。全区間が他状態と非交差なら一意。未知または複数候補のコードは-1、その他は押下ビットマスク。実機の入力負荷、接触抵抗、ADC非線形性、チャタリング、過渡応答は未モデル化。高抵抗での実用性や電源・入力仕様は別途確認。安全重要用途には使わない。

## テスト結果（2026-11-28）
- `node test.cjs`: 独立公差コーナー全列挙とコード照合200ケース、固定7アサーション合格。最大8枝256状態を確認。
- `python test_browser.py`: Chromiumで初期値、近似2進重み例、絞込、JSON/C++ダウンロード、プローブ、不正入力、リセット、390px幅を確認。JS例外・外部HTTP要求0件。環境のfile URL制限によりHTMLのインライン読込で実行。PlaywrightとChromiumが必要。
- サンプル（10bit、公差1%、追加誤差2コード）: 初期16状態中9状態が全範囲一意、衝突6ペア、曖昧16コード。代替例は16状態すべて一意、衝突0。実機検証・生成C++のコンパイルは未実施。

## 重複確認
直近の会話履歴、専用ブランチとmainの比較結果に現れた51ディレクトリ、ADC/resistor/analog button/抵抗/分圧のコミット検索で明確な重複なし。検索の範囲外は未確認。
