# 皿めぐり / SARAMEGURI — リユース食器循環台帳

自治会、学園祭、地域イベントのスタッフ向け。繰り返し利用する食器の「洗浄済み → 使用中 → 回収待ち → 洗浄中 → 洗浄済み」を数量で記録し、ピーク時の需給をシミュレーションする無料・登録不要のMVPです。

## 選定理由・市場調査

- 日本：大阪市が **2026-11-04** にイベント主催者向けリユース食器導入ガイドを公開（https://www.city.osaka.lg.jp/kankyo/page/0000687593.html）。港区は **2026-05-01** に食器レンタル助成制度を案内（https://www.city.minato.tokyo.jp/gomigenryou/riyu-susyokkihojyo.html）。北区は **2026-02-18** にイベント実証実験を報告（https://www.city.kita.lg.jp/living/bins/1002115/1025358.html）。
- 国内の近接競合：リユース食器ネットワーク（2026年4月時点25団体）は貸出・洗浄等を行う団体を紹介。https://www.gef.or.jp/activity/3r/reusenetwork/
- 海外の近接競合：TOMRA（QR付き回収・デポジット・洗浄インフラ、2025-05-27）https://www.tomra.com/news-and-media/news/2025/tomra-unveils-automated-collection-point-for-reusable-takeaway-food-packaging 、r.World（イベント等の循環運用）https://www.packworld.com/sustainable-packaging/reusable-returnable/article/22958181/rworld-prevents-20m-singleuse-cups-from-going-to-landfill 。EU包装規則 https://eur-lex.europa.eu/eli/reg/2025/40/oj も再使用の背景要因。
- **差別化仮説**：イベントごとの小規模運用では、1個ずつのQR管理や決済よりも、*数量入力だけでの循環記録・取り消し・洗浄能力の不足試算* の一体提供に価値がある。実際の支払意向・収益性は未検証。

## 実装

- 最大40種類。状態別集計、提供・回収・洗浄投入・洗浄確認・紛失・破損・追加搬入、数量不足チェック、操作履歴とUndo。
- 需要1〜48枠、返却遅延、洗浄遅延、1枠あたり洗浄投入能力から提供不足と追加必要数を試算し、チャート・表で表示。
- JSONバックアップ・復元、在庫CSV、履歴CSV、印刷、localStorage。個人名の入力は不要。外部API、CDN、課金、分析SDKなし。
- `index.html` を開くと4つの `payload-*.js` から**完全版と同一のHTML**がgzip復元されます。ブラウザに標準の `DecompressionStream('gzip')` が必要。オフラインの可読ソースは `python unpack.py` で `index.unpacked.html` に復元できます。

## 検証（2026-11-23）

- 完全版に対して `node --test engine.test.cjs` **28/28合格**。数量保存・Undoの1,000系列と需給予測の500系列の不変条件を含みます。
- 完全版に対してChromium/Playwright **37/37合格**。数量操作、Undo、JSON/CSV出力、XSS非実行化、需給計算、モバイル等。外部HTTP・JS実行例外0件。
- GitHubの4分割データは原データからロスレスgzipで生成。転送後に各断片を再取得してチェックサムを照合。HTML完全復元の期待SHA-256は `7b9786f8bf2938348deaf641af36244ceebef1198f3871593e3821c745bb929e`。
- **制限**：実ブラウザでの `file://` 直接起動は管理環境で遮断され、Playwrightは同一HTMLをインライン実行し localStorage はメモリ模擬。GitHub版のブラウザ直接起動も未検証（圧縮データの一致を検証）。現場での衛生判断や需要予測の精度も未検証。

## 注意

洗浄完了数は現場の衛生手順を満たすと担当者が確認した場合にのみ入力してください。**洗浄工程の適否や法令適合を判定しません。** 返却と洗浄は入力した時間枠・能力が守られる仮定での数量モデルです。需要の確証ではありません。

## ライセンス

MIT。ソースコード・実行検証スクリプト・スクリーンショット一式は同時配布したZIPに収録しています。