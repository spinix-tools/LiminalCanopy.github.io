# 変速路 / HENSOKURO — 速度区間別ギア経路プランナー
2026-11-24 制作。**ロード・グラベル・クロスバイクの愛好者、ツーリング計画者**向け。入力した速度区間を通じて、ケイデンス目標と変速負担を両立するギア列を計算する登録不要・無料のWebアプリ。

## 市場・競合・選定理由（2026-11-24調査）
- **国内市場の兆候**：[自転車産業振興協会](https://jbpi.or.jp/business/business/statistics/production_dynamics/)はスポーツ車種を含む生産・輸入・POS統計を公開。2026-05-08の[マイナビのCYCLE MODE取材](https://news.mynavi.jp/article/20260508-4396027/)はロード・MTB・グラベルの試乗機会を紹介。ただしアプリ需要や支払意向を直接示すものではない。
- **日本の競合**：[ToolsAhuro](https://tools.ahuro.com/tools/gear-ratio) は全ギアの速度・展開長を表示。[Cycle Gear Ratio Calculator](https://cycle.progra.biz/) は仮想シフターを提供。
- **海外競合**：[BikeCalc](https://www.bikecalc.com/index.html) は比較・構成管理・速度計算。[GearCalculator](https://gearcalculator.cc/en/) は回転数・速度・パワー試算。[Chris Collins (2026-10-15)](https://geekychris.github.io/tools/bike-gears/) はギア段差・ドライブトレイン比較。
- **差別化仮説**：静的な全ギア表に対し、区間ごとに速度・継続時間を置き、変速回数・前後の切替負担も含めて**走行全体のギア経路を最適化**する。競合と一部機能は重複し、利用需要・収益性は未実証。

## 操作できる機能
- 前歯1–3枚・後歯1–14枚、実測タイヤ周長、希望rpmと快適帯、前後の切替負担を設定。
- 最大36区間の目標速度・継続時間・名前を追加編集／並べ替え／削除、街乗り・丘陵・グラベルのプリセット。
- 動的計画法で入力した評価関数の**厳密最小スコア**を計算。範囲外の二乗ペナルティ、希望rpm差、区間時間、変速コストを合計。斜め掛けは簡易ルールで除外できる。逐次選択との比較。
- SVG回転数推移、推奨前後歯数と変速手順、全ギア表、警告、JSONバックアップ・復元、CSV出力、印刷、端末内保存、構成操作のUndo。通信・CDN・課金・個人情報収集なし。

## 起動と検証
GitHubの `index.html` は `payload.js` をブラウザ標準の `DecompressionStream('gzip')` で展開して、**ZIP収録の完全版と同一HTML**を起動。 `python3 unpack.py` で可読な単独HTMLへ復元可能。ZIPには分割可読ソース、テスト、画面画像が含まれる。

- `node --test engine.test.cjs`: **14/14合格**。独立全探索照合 **450ケース**、ランダム換算・不変条件 **1,200ケース**を含む。
- `python browser_test.py`: Chromium操作 **30/30合格**（追加/編集/上下移動/Undo/プリセット/入力検査/表示切替/モバイル/XSS防止）、JS例外 **0**、外部HTTP要求 **0**。
- GitHubローダーは同じ圧縮コードをインライン展開した画面描画の検証に成功。管理環境では `file://` と localhost の直接遷移が遮断されるため、直接ファイル起動・GitHub URL起動・localStorage継続・実印刷・実走は未検証。
- 「最適」は**入力したモデル・重み・ギア候補の範囲だけ**。速度達成可能性、坂・風・疲労、駆動系互換性、チェーン長、交通安全は判定できません。

ライセンス MIT。保存先は `spinix-tools/LiminalCanopy.github.io` の `hourly-app-lab/apps/2026-11-24-hensokuro/`。既存 `main` には書き込みません。
