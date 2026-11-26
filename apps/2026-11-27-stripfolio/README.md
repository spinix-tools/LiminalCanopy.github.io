# StripFolio / ネガ収納設計

35mm等間隔フルフレームのコマ番号を入力し、切断禁止境界と既切断境界を守りながら、ネガシートへの収納計画を比較する。index.html をブラウザで開く。外部依存・通信・アカウント不要。写真や個人情報の入力不要。

## ターゲット・選定理由（2026-11-27）
フィルム写真愛好家、小規模現像ラボ、写真資料整理担当者。国内では富士フイルムが7段ネガシートを供給し、ビックカメラでは6コマ切用の製品が掲載される。フジカラー広島中央には長巻返却オプションがある。海外ではPrint Fileの5コマ×7段、6コマ×6段、6コマ×7段の製品が流通。物理的な収納・切断の課題があると推定した。

## 競合・差別化仮説
NegativeArchiveは現物の収納位置の記録、FilmArchiveはロール管理・コンタクトシート作成、FilmLabはネガのデジタル化。StripFolioは切断前の制約付き収納計画に特化し、連続コマを分断せず候補シートを比較する。直接競合の不存在、利用者数、収益性は未検証。日本語の検索流入から検証し、英語UIを次段階で検討。

- 国内: https://www.fujifilm.com/jp/ja/business/photofinishing/package/negasheet
- https://www.biccamera.com/bc/item/1672842/
- https://fuji-hcweb.com/developing/colornega/
- 海外: https://www.glazerscamera.com/collections/negative-sleeves/products/print-file-35-7b-100
- https://www.glazerscamera.com/collections/negative-sleeves/products/print-file-35mm-35-6b-100pack
- https://www.glazerscamera.com/collections/negative-sleeves/products/print-file-7-35-42-frames-x25
- https://apps.apple.com/br/app/negativearchive/id6826638471
- https://apps.apple.com/gd/app/filmarchive-film-photography/id6797991676
- https://www.filmlabapp.com/

## 機能と検証
1〜120コマ、最大12コマ×12段の任意候補と3標準例。動的計画法でストリップ本数を最小化、同数では各段の未使用コマ数の二乗和を最小化。既切断数は固定なので新規切断も最小。候補間はシート枚数、新規切断数、空き段数の順に比較。視覚プレビュー、JSON出力、印刷ボタン。
初期例36コマ・禁止境界5箇所では6×7が1枚・7本・新規切断6箇所、6×6は2枚、5×7は2枚。既存履歴・比較差分51ディレクトリ・関連4語のコミット検索では同案を確認せず（全ソース網羅ではない）。
- `node test.cjs`: 独立全列挙との600ケース照合、固定8アサーション合格。
- `python browser_test.py`: Playwright/Chromiumで候補切替、入力変更、重複境界、全候補不可、JSON実ダウンロード、390px幅、JS例外・外部HTTP要求0件を確認。file URLが環境で禁止されるため同じHTMLをインライン読込。実印刷・実機未検証。

## 制限
コマ間の実際の安全な切断位置、寸法、端部、材質、ハーフ・パノラマ、保存品質は判断しない。切断は不可逆なので現物を確認し、不明な境界は切断禁止にする。1ロールずつ計画する。実需要・収益性は未検証。追加API課金なし。
