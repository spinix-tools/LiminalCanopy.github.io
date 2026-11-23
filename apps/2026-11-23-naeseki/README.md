# 苗席 / NAESEKI 🌱

**対象** 家庭菜園、学校の菜園、園芸教室など。播種日から定植予定日までセルトレイの各セルを予約し、物理的に不足するバッチを見つける完全ローカルWebアプリ。

## 市場・競合（2026-11-23調査）

- 国内：タキイ種苗[2026年3月4日調査](https://www.takii.co.jp/info/news_260304.html)は20〜69歳400人を対象とし、未経験者の40%が家庭菜園に前向き。矢野経済研究所[2024年12月25日](https://www.yano.co.jp/press-release/show/press_id/3700)は国内ガーデニング・家庭菜園市場を2023年度2,321億円と推計。ただしアプリ需要の直接証拠ではない。
- 国内の近接競合：[種ごよみ](https://apps.apple.com/jp/app/id6816881926)、[Mebuki](https://apps.apple.com/jp/app/id6759305787)、[Cultivy](https://apps.apple.com/jp/app/id6781305374)。
- 海外競合：[Seedtime](https://seedtime.us/pages/features-calendar)、[GrowVeg](https://www.growveg.com/garden-planner-intro.aspx)、[Seed Tray Planner](https://mwm.ai/apps/seed-tray-planner/6778090598)。

**差別化仮説** 畝・収穫予測ではなく、育苗中のセル占有を日別に追跡し、全バッチの同時需要と未配置セルを分離して表示。候補日へずらす際は未配置バッチ数が減る場合だけ提案する。需要と収益性は未検証。

## 使い方

`index.html`と`payload-1.js`〜`payload-3.js`を同じディレクトリに置いて開く。ブラウザのgzip展開に非対応の場合は`python3 unpack.py`で完全版`standalone.html`を復元できる。

実装：トレイ枚数・行・列、バッチ編集・追加・複製・削除、占有と超過日数、42日タイムライン、セルマップ、日付調整候補、JSON入出力、CSV出力、印刷、ブラウザ内自動保存。播種日を含み定植予定日を含まない期間に各セルを占有する。農学的に最適な日付の助言ではない。

## 検証

- `node test_engine.cjs`：26/26単体テスト＋ランダム600計画合格。
- `python test_browser.py`：Chromium操作28/28合格、外部通信・JavaScript例外0件。
- GitHubのgzip起動版もChromium上で展開・描画に成功。元の完全版SHA-256: `6fbdcf6320908fb1bb9cdfbc4209ef20dc836e8b2cba0eb98d559dd0de209add`。
- 制限：管理環境のURL移動制約により、ChromiumではHTMLをインライン実行。端末保存はメモリ模擬。実ファイル・実育苗の検証は未実施。

完全な可読ソースとテストはローカル成果物ZIP内。MIT License。課金・外部API・個人情報の送信なし。