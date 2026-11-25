# 袋余 / SleevePool (2026-11-26)

## 対象・市場
ボードゲーム愛好家、カフェ、複数の拡張セットを所有する人。国内のゲームマーケット2025春は2日間で2.7万人（2025-05-21報道）。これは利用者候補の規模を示す間接指標であり、アプリ需要や売上の推計ではない。
- 国内: [HOBBY Watch](https://hobby.watch.impress.co.jp/docs/special/2015628.html)、[スリーブイン](https://sleeve-in.com/)（適合・必要袋数）、[ホビーサーチ](https://www.1999.co.jp/10732872)（複数サイズの販売）。
- 海外: [BGG](https://boardgamegeek.com/wiki/page/Card%20Sleeves)（サイズ情報）、[Sleeve Kings](https://sleevekings.com/collections/sleeves-by-skus)（1万超のゲーム・拡張の対応検索）、[BoardGame Sleeve Inventory](https://apps.apple.com/us/app/boardgame-sleeve-inventory/id6803298666)（在庫・不足管理）、[BoardFit Atlas](https://boardfitatlas.com/tools/)（袋数・余剰・予算計算）。

## 差別化仮説
ゲーム別の適合検索・袋数計算だけでなく、複数デッキで在庫を共有し、各デッキは同じSKUに統一する制約のもと、候補SKUへの割当と購入袋数を同時に最適化する。競合に同等機能がないことは未証明。無料の日英対応版や店舗向け一括計画への拡張を検証候補とする（現版は日本語のみ）。利用者実測・収益性は未検証。

## 起動・仕様
index.html をブラウザで開く。最大8デッキ・各500枚、6 SKU。デッキ行は `名前 | 必要枚数 | 適合SKU,SKU`、商品行は `SKU | 手持ち | 袋枚数 | 円/袋 | 購入上限`。各デッキは分割しない。適合はユーザーが確認して入力。必要数に予備を含める。分枝限定探索は購入費、購入枚数、袋数の辞書式順で厳密最小化する。全件割当不可の場合は部分案を出さない。JSON出力・印刷対応。送料、寸法、厚さ、ロット差、収納、通貨換算は対象外。外部API・通信・自動保存なし。

## 検証
`node test.cjs` : 固定8件、独立した購入袋数全列挙との比較300件、最大8×6・4000枚ケース合格。
`python browser_test.py` : Chromium（Playwright、/usr/bin/chromium）でサンプル440円、JSONダウンロード、入力不正、解なし、旧結果無効化、HTML安全表示、初期化、390px幅、HTTP通信・JS例外0件を確認。環境制限でfile://直開きが拒否されたためHTMLインライン読込で実施。印刷実機未検証。サンプルは架空。

## 重複確認
専用ブランチのmainとの差分300ファイル（51ディレクトリ）と、sleeve / スリーブ / カード保護 / boardgame のコミット検索、直近の制作履歴を照合。確認範囲で同用途なし。全履歴・全READMEは未確認。
