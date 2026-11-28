# CrawlContract / robots.txt 回帰テスト v1.0

- 対象: SEO担当者、Web制作会社、サイトリニューアル・AIクローラー方針の管理者。
- 選定理由 (2026-11-29): 特定Botの個別グループを追加すると、従来のワイルドカードグループのルールが適用されなくなる場合がある。公開前の事故防止に需要があるという仮説。
- 国内: ITLibraの[テスター](https://check.itlibra.com/tools/robots-txt)、Esolabの[作成・チェック](https://esolab.co.jp/tools/robots-txt/)。海外: Seitenreportの[変更シミュレーター](https://seitenreport.de/en/seo-tools/robots-txt-change-simulator)、ToolSorcererの[比較・検査](https://www.toolsorcerer.com/robots_txt_generator)。前後比較は既存機能なので独自性とはしない。
- 差別化仮説: Bot×パスごとに期待する許可・拒否・現状維持を明文化し、変更有無と契約合否を別々に判定する。複数Botの再利用可能なテスト契約と根拠行番号をJSONで保存する。市場規模、検索数、競合全機能、収益性は未確認。
- 重複確認: 直近の会話、mainとの比較APIが返した300ファイル（51アプリディレクトリ）、robots.txt・RobotsDelta・crawlerのコミット検索（各0件）。全既存アプリの網羅確認ではない。

## 起動
`index.html` をブラウザで開く。外部依存なし。変更前・変更後のrobots.txtと、`Bot /path allow|block|keep` の行を入力して実行。`keep` は変更前の判定維持。JSONには入力全文も含むため、共有前に確認すること。

## 実装範囲
[RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html) を参照した限定モデル。ASCIIパスのみ、%・#・空白は拒否。Bot名は英字・ハイフン・アンダースコア。大文字小文字を区別しない完全一致のBotグループを結合し、なければ * グループを使用。パスは大文字小文字を区別し、* と末尾 $ に対応。パターン文字数（記号を含む）で優先順位を決め、同長ならAllow優先。/robots.txt は既定許可。空のルールは無効。他の指令は警告のみ。非ASCII、パーセント符号化、クローラー固有差異、HTTP取得失敗・キャッシュ、実クロール・インデックスは非対応。各ポリシー30,000文字・300ルール、200契約、パス300文字まで。アクセス制御ではない。

## 検証
- `node test.cjs`: 固定15件、独立正規表現との生成パターン照合1,000件、すべて合格。
- `python test_browser.py`: Chromium + Playwright、サンプル8件・違反1件・許否変化2件、絞り込み、JSONダウンロード内容、編集時の旧結果無効化、非対応入力拒否、リセット、390px幅での横溢れなしを確認。JS例外・外部HTTP要求0件。環境制約によりHTMLをインライン読み込み（file://直開きは未検証）。
- 最大規模性能・他ブラウザ・実クローラーとの照合は未検証。追加課金、API、外部送信、個人情報収集なし。
