# 照合境界 / KeyFrontier
2026-11-26 — 非個人識別子の照合ルール移行を事前監査する、登録不要のローカルWeb MVP。

## 対象・選定理由
小規模EC・部品在庫・データ移行担当者。国内ではMicrosoftの日本語サポートが商品コード等の先頭ゼロ消失を明示し、2026-11-18の国内実務記事も同じ課題を扱う。海外ではUnicode仕様がNFKCによる意味上重要な区別の消失を警告し、専用SKUクリーナーも存在する。需要の傍証であり、利用者数・支払意思は未検証。
- 国内: https://support.microsoft.com/ja-jp/excel/keeping-leading-zeros-and-large-numbers
- 国内: https://note.com/modern_ixia236/n/n14c6f1fe2996
- 海外: https://www.unicode.org/reports/tr15/
- 競合: https://www.ecech.com/t/duplicate-sku-master-checker/ （重複監査）
- 競合: https://www.warelium.com/sku-cleaner/ （正規化・衝突確認・出力）
- 競合: https://a2z.tools/csv-join-merge-planner （結合プレビュー・多重化監査）

## 差別化仮説
単一の正規化でデータを書き換えるのではなく、5ルールの全32組合せを同時に比較。新規一対一候補、曖昧行、元の完全一致ペアの喪失を原文・行番号付きで示す。4指標（一対一件数最大、曖昧行・失った完全一致・ルール数最小）で非劣解を抽出。照合候補は同一商品・部品の証明ではなく、人手確認が必要。既存234ディレクトリ名と関連READMEを確認。KETAMAMORIはCSV変換事故の監査、SABUNMON・NEFUDA SABUNは商品差分の確認であり、今回の主目的はルール選択の比較。全既存コードの網羅的照合は未実施。

## 起動・仕様
index.htmlをブラウザで開き、A/Bに1行1コード（非個人識別子）を貼り付ける。各2,000行、各行120 UTF-16コード単位まで。空白のみの行は除外。比較順はNFKC→trim→ASCII小文字→ハイフン類→ASCII数字のみの先頭ゼロ除去。元データは変更しない。重複グループを自動結合せず、選択した監査結果をJSON出力（全グループ＋全32案の集計）。表は最大200グループ表示。外部API、外部通信、永続保存、個人情報収集なし。CSV列抽出・Unicode完全casefold・意味照合は対象外。

## 検証
`node test.cjs`: 固定10件、100入力×32ルールの独立行数比較3,200件に合格。各2,000行を含む。`python browser_test.py`: Chromium（Playwright、/usr/bin/chromium）で選択・衝突・フィルタ・JSON実ダウンロード・入力変更・境界値・安全なテキスト表示・初期化・390px幅に合格。JS例外、HTTP(S)要求とも0件。環境のfile://制限によりHTMLをインライン読み込み。実データ・利用需要・他ブラウザは未検証。

サンプル（架空コード）: 完全一致1件、先頭ゼロ以外の4ルールで一対一7件（新規6、曖昧0）。全5ルールでは一対一6件、曖昧3行、既存完全一致1件喪失。新規候補を増やすだけでなく既存ペアの保護が必要な例。
