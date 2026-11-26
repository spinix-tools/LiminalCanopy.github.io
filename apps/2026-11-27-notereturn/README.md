# NoteReturn / 注釈往復検査

2026-11-27 · MVP · HTML単体・オフライン

## 対象と選定理由
電子書籍の編集者・制作会社・個人出版者。本文の注番号から注へ移動できても、複数の参照元のうち一つにしか戻れない問題は、単純なリンク切れ検査では区別しにくい。国内の電書連は2025-10-24にEPUB 3.3対応制作ガイドを公開。海外ではDAISYが注の戻りリンクと複数参照元の問題を解説している。需要の存在を示す定性的根拠であり、市場規模・支払意向は未検証。

- 国内: https://dpfj.or.jp/counsel/guide
- 国内向け配信仕様: https://help.apple.com/itc/booksassetguide/ja.lproj/static.html
- 海外の推奨・複数参照問題: https://kb.daisy.org/publishing/docs/html/notes.html / https://kb.daisy.org/publishing/docs/html/reflinks.html
- 競合・補完: EPUBCheck（規格・内部参照整合性）、Ace by DAISY（アクセシビリティ自動検査） https://daisy.org/guidance/info-help/guidance-training/standards/epub-conformance-and-validation/

## 差別化仮説
参照元ごとに往復を照合し、参照先が存在するだけの状態と正しい戻り先がある状態を区別する。既存の総合検証器を置き換えず、修正箇所を絞る補助ツール。競合に同等機能がないとは断定しない。将来は修正前後比較を検討。既存253ディレクトリ名と4語（epub、脚注、注釈、backlink）のコミット検索を確認、明確な重複なし（全ソース未照合）。

## 使い方
index.htmlをブラウザーで開く。サンプルは3参照、1往復成立、3指摘。展開したEPUBのXHTMLフォルダーを追加するか、パスとXMLを手入力する。編集後は追加/更新、検査する、JSONレポート。個別ファイル追加は同じ階層を想定。相対パスを保持すること。

## 検査範囲
role / epub:type の明示的な注・注参照、同一・別ファイルのID、重複ID、欠損、未読込先、誤った明示的戻りリンク、各参照元への戻りリンク、孤立注。戻りリンクの存在は独自QA方針であり規格違反やアクセシビリティ不適合を意味しない。EPUB ZIP展開、OPF、XML DTD、base、外部リンク、未マークの注、実際のリーダー挙動は対象外。100ファイル、各100万文字（ファイル入力は100万バイト）まで。実原稿は送信・永続保存しない。外部API・依存ライブラリなし。

## テスト
`python test.py`（Python Playwright、/usr/bin/chromium）。16/16 コアアサーション成功。Chromiumでサンプル、編集、旧結果無効化、JSONダウンロード、390px幅、JS例外0・HTTP要求0を確認。環境制限でfile://起動は不可、同じHTMLをインライン読込。実EPUB・他ブラウザー・実リーダー・需要検証は未実施。
