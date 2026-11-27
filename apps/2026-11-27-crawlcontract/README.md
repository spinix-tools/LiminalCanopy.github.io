# CrawlContract / クロール契約テスト
2026-11-27 MVP。index.html をブラウザで開く。サーバー、登録、外部ライブラリ不要。

## 対象・選定理由
SEO担当者、Web制作会社、EC運営者。robots.txt変更時の意図しないクロール許可・拒否を、公開前に回帰テストする。日本にはマッハーツールやEsolabの作成・検査ツール、海外にはTNAADOのマトリクス、RankThisPageの変更影響比較がある。Google Search Consoleの旧テスター終了は国内でも報道された。需要の傍証であり市場規模や支払意思は未測定。

## 差別化仮説
単なる差分ではなく、各クローラー・パスの期待値 allow / block / same を明示して合否判定する。変更が正当な場合も、変更がなくても期待に反する場合も区別できる。繰り返し使うTSV契約とJSON証跡を提供する。既存サービスに同等機能がないとは断定しない。専用ブランチの再帰ツリーにあるアプリ名と直近会話を確認した範囲で同種の明確な重複なし（全ソース未照合）。

## 操作
1. 同一オリジンの変更前後のrobots.txtを貼る（空欄はルールなし）。
2. 1行につき製品トークン、/から始まるパス（クエリ可）、期待値をタブで区切る。最大500ケース、各版300非空ルール、各パス500文字。
3. 実行、違反・変更の絞り込み、根拠行の確認、JSON保存。サンプルは6件中2件違反・2件変更。

## モデル・限界
製品トークン完全一致（大文字小文字無視）、同一グループ結合、*グループへのフォールバック、先頭一致、*と末尾$、正規化後のルール文字列長による優先順位・同長Allow優先、UTF-8と非予約ASCIIの%表記を扱う限定モデル。製品トークンは英字・ハイフン・下線のみ。URLではなくパスを指定。異常な構文は停止し、その他の指令は注記して無視。Google固有の別名・寛容な構文、全RFC境界、HTTP状態・キャッシュ・索引登録・アクセス制御は保証しない。入力は端末内のみ。秘密URL・個人情報は不要。追加API課金なし。

## 検証
- `node test.cjs`：固定16件、独立正規表現との2000照合、300ルール×500ケースの容量検査に合格。
- `python browser-test.py`：既設Chromium/Playwrightで6件表示、違反フィルタ、JSON実保存、入力変更時の無効化、不正入力、サンプル復元、組込テスト、390px幅、JS例外・HTTP要求ゼロを確認。file://は環境の管理ポリシーで拒否されたため同一HTMLのインライン読み込み。実サイトやクローラーでは未検証。

## 調査資料（2026-11-27確認）
- 国内: https://www.mach-tools.net/seo/robots/ ; https://esolab.co.jp/tools/robots-txt/ ; https://www.suzukikenichi.com/blog/robots-txt-report-avilable-in-search-console/
- 海外: https://tools.tnaado.ca/seo/robots-txt-tester/ ; https://rankthispage.com/robots-txt-tester ; https://www.toolsorcerer.com/robots_txt_generator
- 仕様: https://datatracker.ietf.org/doc/rfc9309/ ; https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec

## 次の検証
国内制作会社と海外の技術SEO担当各5人に合否テストの再利用性を確認する。実サイトの公開前QAで誤判定率・修正時間を測る。成果は未検証。
