# 見積ゆらぎ / MITSUMORI YURAGI

相見積もりの税区分・必須項目・追加費用の「幅」を比較する、登録不要の日本語Webアプリ。

## ターゲットと市場
施主、自治会・学校等の小規模修繕担当者向け。矢野経済研究所の2026年発表による2025年国内住宅リフォーム市場規模推計は **7兆5,119億円**。これはアプリの市場規模ではありません。住まいるダイヤルは見積書の比較表・数量・仕様・追加費用の確認を推奨しています。
- 国内需要: https://www.yano.co.jp/press-release/show/press_id/4153
- 国内ガイド: https://www.chord.or.jp/reform/basic_knowledge/index.html
- 国内競合: AIMitsu（AI見積書解析・相場照合） https://aimitsu.benstay.jp/ja/
- 海外競合: BidGauge（AI比較） https://bidgauge.com/ / AMAIQBUILD（有料の手入力比較） https://amaiqbuild.com/compare-contractor-quotes/ / houex（無料比較ツール） https://houex.com/tools/bid-comparison

## 選定・差別化仮説
価格だけでなく「含む / 別途 / 未確認」を **入力者が明示** し、除外項目は[下限, 上限]、未確認は[0, 上限]という**仮定の幅**で比較。区間が重なれば最安は確定しない。税別の税込換算、質問事項の自動抽出、ローカル完結を組み合わせる。実需・収益性は未検証。

## 使い方・機能
`index.html` をブラウザで開く（単一HTML、追加サービス不要）。架空の見積例から開始し、見積（最大4社）と必須作業（最大20）を入力。各行の状態を選ぶと計算が更新される。JSON保存/復元・CSV出力・確認事項のTXT出力・印刷・端末保存を用意。

## 検証
完全版ローカルMVPは Node.js **17/17 PASS**（ランダム1,000系列を含む）、Chromium **26/26 PASS**（外部HTTP要求0、JS例外0）。GitHub版はブラウザ対応の簡素な別実装で、同じ算定原則を使う。**GitHub版自体の上記テスト通過を意味しない**。管理環境では file:// がブロックされるため、完全版HTMLをChromiumへインライン挿入して検証し、端末保存はメモリ模擬。実案件の金額妥当性や施工・契約上の安全は保証しない。

## 制約
当アプリは見積書を自動解析せず、市場相場、将来費用、契約法務、施工品質を判断しない。価格幅は信頼区間ではなく利用者が置いた仮定。個人情報・秘密情報は入力しないこと。外部API、追加課金、トラッカー、情報送信なし。より専門的なチェック: https://www.chord.or.jp/reform/

MIT License · 2026 Hourly App Lab.
