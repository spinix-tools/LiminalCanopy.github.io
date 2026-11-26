# RisoTrap / 版ずれラボ
2026-11-27 MVP — 2色の二値版について、想定した位置ずれで生じる紙地の欠けを検査する。

## 対象・選定理由・差別化仮説
ZINE作家、孔版印刷の入稿担当者、デザイン教育。版ずれと重ね代は国内外の印刷所・教育機関で実務上の注意事項として扱われている。既存の色分解やプレビューに対し、全整数方向の欠けを定量化し、追加セルを最小限にする検査に特化。需要規模・支払意思・競合の全機能は未検証。
- 国内: [石引パブリック](https://ishipub-printing.com/risograph_printing/about/)（1〜2mm程度の版ずれの注意）、[太陽出版](https://www.taiyoushuppan.co.jp/doujin/howto/vocabularyprint01.php)（トラッピング）。
- 海外: [College for Creative Studies](https://campus.collegeforcreativestudies.edu/imaging-center/2021/06/22/registration-trapping/)（重ね代の解説）、[RISOTTO](https://risottostudio.com/pages/print-simulator-ink-shift)（重ね刷りプレビュー）、[ProDesigner](https://www.prodesigner.app/ja/tools/risograph/)（分版・プリフライト）。

## 操作とモデル
index.htmlをブラウザで開く。A=固定版、B=移動版、X=両版、.=紙地。最大80×80、ずれ±0〜5セル。検査後に方向を選択し、欠け・重なり・はみ出しを比較。JSON、修正版マスク、Bの二値PNGを保存できる。
固定版Aは不変。元のB専有セルが全方向で覆われるか検査し、欠ける各セルの逆移動先が元のA専有セルならBに追加する。各欠けに対応する追加位置は一意なので、全ずれの欠け延べ数を最小化し、その条件下で追加セル数を最小化する。許可外や版外の欠けは残る。重なり・はみ出しは報告するが最適化しない。

## 検証
`node test.cjs`：全256個の2×2マスク×3ずれ範囲の独立全列挙（768件）、固定7件合格。80×80・121方向を含む。`python browser_test.py`：Chromiumで方向選択、3種の実ダウンロード、不正入力、結果無効化、390px幅、JS例外・HTTP要求0件を確認（インライン読み込み）。実際の印刷、物理寸法・紙伸縮・網点・インキ濃度は未検証。PNGは検討用。外部依存・課金・データ送信なし。
重複調査：専用ブランチの255ディレクトリ名（関連語）と risograph / trapping / 版ズレ / risotrap のコミット検索、直近の会話を確認。全既存ソースは未照合。
