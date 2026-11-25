# 糸継 / ITORELAY
2026-11-25 | 単針刺繍ミシンの作品横断段取り最適化 MVP

## 対象・選定理由
小規模刺繍工房、ハンドメイド作家、刺繍教室。単針機の糸替えは手作業であり、複数作品で同じ糸を使うときに順番の工夫で段取りを減らせる可能性がある。
- 国内需要の手掛かり: [ブラザー SKiTCH PP1](https://www.brother.co.jp/product/hsm/embropc/pp1/index.aspx) は既製品への刺繍・スマホ編集を訴求。[ミシンのフジモト](https://mishin-fujimoto.com/toriatsukaimishin/) は単針業務機の展示と刺繍講習を案内。
- 海外需要の手掛かり: [Embrizo（2026-11-11更新）](https://www.embrizo.com/guides/how-to-reduce-color-changes-in-embroidery) は単針機の糸替え削減と注文のバッチ化を紹介。[ThreadReady](https://threadready.com/help/labels-and-work-orders) は糸替え時間の実測設定を提供。
- 競合: [ブラザー刺しゅうPRO11](https://www.brother.co.jp/product/hsm/embropc/shishu-pro-11/spec/index.aspx) は刺繍データ作成、[Wilcom](https://docs.wilcom.com/embroiderystudio/26/en/OnlineHelp/Modifying/combine/Auto-sequence_entire_designs.htm) は重なりを維持したデザイン内の色替え最適化、[StitchCapacity](https://stitchcapacity.com/tools/order-mix-planner/) は複数注文の生産能力比較。
- 差別化仮説: デザイン内部の順序を変更せず、異なる作品間の工程の組み合わせを、糸替え・枠替え両方の実測秒数で最適化する。登録不要の計画専用ツール。独自性・需要・収益性は未検証。確認日2026-11-25。

## 使い方
index.htmlをブラウザで開く（依存なし）。1行1作品、空白区切りで糸コードを入力。1〜4作品、各1〜8工程。糸替え・枠替え時間を指定し最適化。途中切替は初期状態では禁止。機器・工程が独立実行可能で再装着精度を確認できる場合のみ許可する。入力順との比較、工程表、CSV、印刷に対応。データは送信しない。

## 計算モデルと検証
進捗ベクトルと直前作品を状態としたメモ化DP。遷移で糸コード・作品の変化に応じた固定秒数を加算し、各作品の元の工程順を保存する。途中切替なしの場合は完了まで同じ作品を選ぶ。初回装着・最終取り外し・縫製時間は比較外。最大32工程。サンプル3作品各「赤 青 白」、糸替え90秒・枠替え15秒で、途中切替許可時750→270秒（糸替え8→2、枠替え2→6）。
- `node test.cjs`: 固定8アサーション、独立全列挙300条件との最適性照合、最大32工程の処理に合格。
- `python browser-test.py`: ChromiumのインラインHTML実行で、最適化、CSV実ダウンロード、390px幅、無効入力、旧結果無効化、リセットに合格。JS例外・HTTP(S)要求0件。環境のfile://制限のため直接ファイルナビゲーションは未検証。実行には既存PlaywrightとChromiumが必要。
- 実機制御・刺繍データの読み書き・枠の再装着精度・糸始末・印刷実出力は未検証。固定時間モデルであり、実測の作業削減を保証しない。途中切替が実行可能な場合に限る。
- 既存ブランチとの差分一覧と「刺繍」「刺しゅう」「embroidery」「thread change」「糸替え」のコミット検索、会話内の既存案を確認。検索範囲で同用途なし。全READMEの照合は未実施。

追加API課金、有料サービス、秘密情報・個人情報の収集なし。
