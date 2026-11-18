# 値札差分 / NEFUDA SABUN

小売店向けのローカルCSV比較・値札印刷Webアプリ。**既存の main やサイトには影響しません。** HTML/CSS/JavaScriptを同じディレクトリに置き、index.htmlを開きます。

## 対象・選定理由
個人商店、雑貨店、ポップアップストアの商品マスタ・プライスカード担当者。POPKITの[PRICEKIT制作決定（2026-08-31発表、2027年初旬予定）](https://prtimes.jp/main/html/rd/p/000000016.000048993.html)は価格変更作業の負担を明示しています。国内の[Square商品マスタCSVインポート](https://squareup.com/help/jp/ja/article/5153-import-items-online)、[Sync Tag電子棚札](https://sync-tag.com/)、海外の[Pricely](https://apps.shopify.com/pricely-4)や[CSVTidy CSV Compare](https://csvtidy.com/tools/compare-csv-files)が競合です。

## 差別化仮説
旧/新CSV→SKUの重複・不正行を除外し理由表示→価格・原価異常の警告→レビューの確認済チェック→印刷対象だけA4 24面ラベル化、を一画面で実現。POS連携や専用ラベルプリンタは不要。収益性や利用需要は未検証。

## 機能
UTF-8 CSV読込・貼り付け、列マッピング、NFKCによるSKU照合、追加/削除/変更/同一、確認チェック、検索・フィルタ、差分監査CSVと値札CSV、A4ラベル印刷。1ファイル2MB/3,000行を目安としています。ファイル内容・価格はサーバーに送らず、ブラウザ内処理。原価や価格の自動確定はしません。

## 検証（2026-11-19）
ローカルの元ソースにて Node.js計算エンジン39/39、Chromiumの画面操作28/28合格。テスト・画面画像は同日のZIP成果物に同梱。通常のfile://起動・印刷実機・本番運用精度は未検証。貼り替え前に実商品と印刷サイズを確認してください。MIT License。
