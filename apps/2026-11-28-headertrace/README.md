# HeaderTrace / 表見出し差分
2026-11-28 · v1.0

## 対象・選定理由
Web制作会社、公共・教育サイトの表を更新する担当者、アクセシビリティQA。国内の[WAChecker](https://toolai.jp/wachecker/)はHTML入力による診断を、[e-Gov](https://www.e-gov.go.jp/about-site/accessibility/checklist.html)は適合試験の結果を公開。海外の[W3C H43](https://www.w3.org/WAI/WCAG22/Techniques/html/H43)は複雑な表の明示的見出し関連を扱い、[wcagkit](https://wcagkit.com/tools/table-checker/)と[AccessibilityToolset](https://accessibilitytoolset.com/tools/text/table-accessibility-checker/)は表の構造・属性を検査する。[Tablenator](https://tablenator.com/)も関連検査を提供する。需要の間接証拠であり市場規模・課金意向は未検証。

## 差別化仮説
単一版の構文チェックだけでなく、表の更新前後を安定したデータセルIDで突き合わせ、存在するが別の見出しへの参照変更や見出し文言変更を検出する。正常な変更も含め、担当者が意図と照合するための回帰検査。既存288ディレクトリ名・直近案・関連コミット4語を確認。候補の柄合わせ裁断は既存RepeatCutとの重複で除外。全ソース照合は未実施。

## 起動と使い方
index.htmlをブラウザで開く。前後それぞれ入れ子なしの表1個を貼り付け、全tdに共通の安定idを付ける。thのidをtdのheadersから参照する。差分検査、絞り込み、セル選択による参照先強調、JSON保存が可能。各10万文字・100行・500セルまで。登録・外部API・入力保存・外部送信なし。入力はinert templateに限定し、プレビューはテキストと結合寸法から再構成する。

## テスト
`python test_browser.py`（Playwright、/usr/bin/chromium）：固定12検査、サンプル、見出し強調、絞り込み、JSON実ダウンロード、不正入力、旧結果無効化、入力スクリプト非実行、390px表示に合格。JS例外0・HTTP(S)要求0。HTMLをset_contentで検証（file URL直接起動は未検証）。初期例は4データセル中4差分、変更後の参照問題1セル。存在する別見出しへの誤参照も差分として検出した。

## 制限
明示的headersの直接参照のみ。scope・暗黙の見出し推論、th自身のheaders、ARIA・CSS・隠し要素・読み上げ順、複数表、rowspan=0、100超の結合、表外の実ページID衝突は対象外。文言は空白正規化したtextContentでありアクセシブルネームではない。データ値そのものの変更は検査しない。セルIDが変われば追加・削除として扱う。WCAG適合や誤参照の意味的正否を判定しない。実際のスクリーンリーダーで確認すること。機密情報・個人情報は入力しない。
