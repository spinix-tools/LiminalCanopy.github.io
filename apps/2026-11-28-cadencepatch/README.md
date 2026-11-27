# CadencePatch — GIFタイミング補正 / GIF timing lab

対象：日本・海外のアニメーター、ピクセルアート制作者、Web制作担当者。24/30fpsの素材をGIFにした際の累積丸め誤差を可視化し、補正した遅延を既存GIFに直接適用する。

## 市場・選定理由（2026-11-28）
- 国内： [TOOL LAB](https://tool-lab.jp/know-how/gif-frame-rate-rounding/) は30fps素材の個別丸めによる速度差と誤差持越しによる修正を報告。[TOONIQ](https://tooniq.co.jp/tools/frame-stopwatch/) は24fpsのコマ単位計測を提供。
- 海外：[Found](https://found-tools.com/en/gif-frame-delay-calc/) はFPS換算、[ToolSorcerer](https://toolsorcerer.com/animation_timing_planner) はタイミング計画、[KlipTools](https://kliptools.com/gif-speed/) は遅延バイトの書き換えを提供。
- 差別化仮説：有理数FPS・画像ごとの保持フレーム数・累積差の比較・既存GIFへの補正を一画面で提供。誤差持越し自体は既知であり、独占的な新規性は主張しない。需要規模・課金意向は未検証。

## 使い方
index.htmlをブラウザで開く。FPS、画像数または保持数、最小遅延を指定し計算。CSVを出力可能。GIF（20MiB以下、最大1000画像）を開くと画像数を読み取り、同数の計画を適用して補正GIFを保存できる。元ファイルは上書きしない。外部通信・登録・APIなし。

## 計算と制限
理想の累積境界を10ms刻みに丸める。終点は丸めた理想総時間と最小遅延×画像数の大きい方。途中は残り画像の最低遅延を確保しながら丸める。全理想遅延が最小値以上なら累積差は最大5ms。制約下の最悪誤差の最適化は保証しない。既存GCEのない画像、ユーザー入力待ち、プレーンテキスト等は拒否。構造検査でありLZWの完全検証ではない。実際の再生速度はブラウザ・プレイヤーに依存する。

## テスト
- `node test.cjs`：固定17アサーション、生成1000ケース合格（総時間・最小遅延・丸め境界・変更バイトの検査）。
- `python browser_test.py`（Playwright、Chromium、Pillow）：同一HTMLのインライン読込でGIF/CSVダウンロード、24画像のデコード後ピクセル全一致、遅延合計1000ms、ループ設定維持、入力不正・画像数不一致・390px表示、JS例外・外部HTTP要求0件。file://は環境でブロックされたため直接起動は未検証。
- 初期例：24fps×24画像、個別丸め960ms、累積丸め1000ms、最大累積差40→5ms。
- GitHubのmainとの比較は300ファイル（51ディレクトリ、上限あり）、コミット検索4語（gif/cadence/animation timing/フレーム）で0件。全既存コードの網羅照合は未実施。
