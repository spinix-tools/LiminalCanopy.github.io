# 入換尺 / IREKAEJAKU — 模型鉄道の入換成立性ラボ

2026-11-24。対象：N/HOゲージ愛好者、模型鉄道クラブ、コンパクトな入換レイアウトの設計者。`index.html` をブラウザで開く。外部API・アカウント・通信・課金不要。

## 市場・競合と選定理由
- 国内：2026年8月の全国高等学校鉄道模型コンテストには207校が参加（[マイナビ、2026-08-10](https://news.mynavi.jp/article/20260810-moraco2026/)）。第25回JAMには84モデラー団体が出展（[主催者、2026-08-05](https://kokusaitetsudoumokei-convention.jp/mp2026/)）。模型の製作活動の指標で、アプリ需要の直接測定ではない。
- 国内の隣接競合：[G-MODE デジプラコレクション](https://www.youtube.com/watch?v=HINFws6tLVo) は鉄道模型風の組立・レイアウトゲーム。今回の検索では国内の同種寸法対応ソルバーは特定できなかった（不存在の証明ではない）。
- 海外：Inglenook Sidingsは定番の入換パズル。[2026-01-24の実演](https://railwaymodels.uk/video-that-model-railway-guy-the-inglenook-shunting-puzzle-on-the-modular-model-railway)も公開。[Inglenook: Train Yard Puzzle](https://apps.apple.com/sg/app/inglenook-train-yard-puzzle/id6828999529) は最短手ヒントや複数のヤードを実装。[Yard Goat](https://keepmytrains.com/play/inglenook) は日替わりWebパズル。[Inglenook Puzzler](https://www.rmweb.co.uk/topic/200242-inglenook-puzzler-%E2%80%93-a-free-digital-companion-for-the-inglenook-sidings-puzzle/) は実物の手持ち車両を登録・問題化するWindowsアプリ。
- 差別化仮説：等長貨車のパズル攻略ではなく、長さが異なる貨車と実測有効長を入力し、各線の延長による可解性・最短移送数の差を比較する設計補助。既存技術との重複はあり、独占性・収益性は未実証。無料の寸法比較を入り口に、模型クラブで設計相談に使われるか検証したい。
- 過去の「停尺 / TEISHAKU」は編成・ホーム長の静的な適合検算。本作は分岐側からの連続貨車移送の状態遷移を探索。既存apps一覧と関連READMEを確認（全ソースの網羅照合はしていない）。

## 機能・操作
貨車2〜6両、3側線+引上線、整数の共通長さ単位、初期配置、A線の目標順を入力。分岐側にある連続貨車だけを引上線と側線の間で移送でき、移送の際に分岐側からの並び順は反転する。引上線の長さは機関車と余裕分を除いた貨車用長さ。各移送を1手とし、幅優先探索で最短手数を算出。目標はA線が指定編成のみ、引上線が空。延長比較の反映、手動操作、Undo、ヒント、順次実行、CSV、印刷に対応。

サンプル：長さ2,1,2,1,1,1、側線5,3,3、引上線2、初期AB/CD/EF/、目標FCA（車止め側順）。現状・A線+1は到達不能、B線+1・C線+1は22手、引上線+1は15手。これは実際の運転時間や安全性の保証ではない。

## 検証・限界
- `node test.cjs`：固定7件、独立探索との照合180件、復元移送127件すべて合格。
- `python browser-test.py`：ChromiumでHTMLインライン実行（環境のfile URL制限）。比較・CSV・延長反映・ヒント・手動・Undo・15手完了・不正入力・390px幅を確認。JS例外・HTTP要求0件。Python PlaywrightとChromiumが必要。
- 6両・3側線・単一引上線の抽象モデル。実際の機関車運転、連結器、曲線・勾配、ポイント位置、車体間隔、動作の連続的な幾何は検証しない。移送回数は実際の機関車の往復数ではない。実物・需要・収益性は未検証。
