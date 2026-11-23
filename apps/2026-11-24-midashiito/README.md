# 見出し糸 / MIDASHIITO
2026-11-24。表計算データの各セルと複数の見出しとの関係を目視で確認し、HTMLの明示的な関連付けを生成するオフラインMVP。

## 対象・選定理由
自治体・学校・企業のWeb更新担当者、HTML/CMS制作者。デジタル庁の2026-03-31更新の方針はJIS X 8341-3:2016とWCAG 2.2を進捗指標に使用。海外ではWebAIM Million 2026で95.9%の調査対象トップページに自動検出可能なWCAG違反があった。ただし表固有の違反率や本製品の需要・支払意思ではない。

## 競合・差別化仮説
国内の制作実務ではaxe-coreやNu Html Checker等が検証に使われる。海外ではtable-a11yが既存HTMLの見出し属性を補完し、W3Cは複雑な表の明示的関連付けを解説。見出し糸はTSVからの新規制作に絞り、セル単位の自動案・色による対応表示・手動修正・HTML出力を一体化。既存の表の自動修正とは異なる。独占的新規性・競合優位・収益性は未検証。既存apps一覧と近接候補を確認し、既存の換水計画案は今回採用しなかった。

参照（2026-11-24確認）:
- https://www.digital.go.jp/accessibility-statement
- https://www.digital.go.jp/accessibility-statement/test-result-2024
- https://webaim.org/projects/million/
- https://pypi.org/project/table-a11y/
- https://www.w3.org/WAI/tutorials/tables/

## 操作・制約
index.htmlをブラウザで開く。2〜40行×2〜20列のTSVを貼り、上の見出し行数と左の見出し列数、表題、ID接頭辞を指定。生成後、データセルを選んで候補を確認・修正しHTMLを保存。空の見出しは候補から除外。再生成は個別編集を初期化する。紐づけ件数は明示的な関連付けの件数であり、適合率ではない。結合セル、引用符付きTSV、既存HTML解析、支援技術による読み上げの検証は未対応。生成された関連付けの意味・WCAG適合・実際の読み上げ順は保証しない。単純な表ではscopeも検討すること。秘密情報や個人情報は入力しない。通信・永続保存・外部ライブラリ・有料APIなし。

## テスト
Python Playwright + Chromiumで同一HTMLをインライン実行（環境がfile://を遮断）。17個のassert合格、2,835通りの長方形・見出し設定を独立した座標計算およびDOM上の参照先と照合。クリック、手動修正、復元、HTMLダウンロード、無効入力、HTMLエスケープ、390px幅の横はみ出しを確認。外部HTTP要求・JS例外ともに0。実ファイルの直接遷移、実際のスクリーンリーダーでの読み上げ、CMSへの組込みは未検証。ローカルZIPのtest.pyで再現可能（Python PlaywrightとChromiumが必要）。
