# BridgeGuard / 型紙の破断監査
2026-11-28 · MVP v1.0

## 対象・選定理由
ステンシルDIY、図工、看板・クラフト制作者。国内のDIY解説には中抜き部分のつなぎが必要と明記され、特注型紙の販売もある。海外には自動ブリッジ生成や幅チェックの競合があり、課題の実在を示す。ただし市場規模・購買意向は未検証。
- 国内: https://diyclip.roymall.jp/interior/1174127
- 国内: https://neoprint.west-tokyo.co.jp/user_data/stencil_font.php
- 日本語対応競合: https://appandtools.com/ja/tool/stencil-maker
- 海外競合: https://maker3c.com/features/stencil-bridges/
- 海外競合: https://cutready.zooshan.com/stencil
- 海外競合: https://www.stencilprint.online/stencil-bridge-maker.html

## 差別化仮説
生成や幅判定ではなく、外周につながった既存デザインが1マスを失った場合の追加脱落面積を全候補について検査する。危険度を順位化し、補強前後の違いを確認できる。競合の内部実装との完全な非重複は未確認。直近の制作履歴、mainとの差分51ディレクトリ、stencil/ステンシル/articulation/bridgeguardのコミット検索（各0件）では明確な重複なし。

## 使用方法
index.htmlをブラウザで開く。0/1の長方形（2〜40行・列）を貼り付けるか、5MiB以下のPNG/JPEG/WebPを読み込む。白・透明は材料、黒は切り抜き。監査後にマスを編集し、破断確認モードまたは順位表から追加脱落を表示。JSONと白黒PNGを保存できる。入力データは端末内のみ、依存ライブラリ・外部API・アカウント不要。

## モデルと制約
上下左右の4近傍。外周の材料を固定し、各内側の接続済み材料を1マス除去してBFSで外周から再到達できる範囲を比較。既存孤立マスおよび破断マス自身を追加脱落に含めない。JSONのセル番号は行優先0始まり。画像の縮小、斜め接続、材料強度、複数箇所の破断、実寸・切断機用ベクターは未対応。物理的耐久性の保証ではない。

## テスト結果
- `node test.cjs`: 独立Union-Find参照との3×3全512パターン＋乱数300ケース、固定5検査に合格。40×40全材料も確認。
- `python browser_test.py`: Chromium/Playwright（環境のfile URL制限のため同一HTMLをset_content）で破断表示、JSON/PNGダウンロード、PNG再読込、編集、無効入力、390px幅を確認。JS例外・外部HTTP要求なし。
- サンプル: 孤立0、危険3マス、最大追加脱落17。4行7列を材料に変更すると危険0。実材料での検証は未実施。
