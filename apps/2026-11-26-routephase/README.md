# 移路 / RoutePhase
2026-11-26 | 段階公開のリダイレクト事前検査

## 対象と選定理由
小規模Web制作会社、SEO担当、CMS移行担当。最終ルールの検査では、途中の公開段階で起こるループ・未登録・誤到達を見落とす可能性がある。国内外に移行監査サービスが存在するが、本製品の需要・市場規模・支払意思は未検証。

- 国内: [サクプラ](https://www.norops.jp/tools/redirect-map-checker)（公開前の対応表検査）、[First CH Apps](https://apps.first-ch.com/redirect-map/)（実際の転送検査）、[検索ブランド相談室](https://rebranding.co.jp/media/redirect-audit/)（2026-10-07更新の監査解説）。
- 海外: [Google](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes)（直接転送を推奨）、[Screaming Frog](https://www.screamingfrog.co.uk/seo-spider/tutorials/audit-redirects/)（クロールによるチェーン検査）、[DigitalSnot](https://digitalsnot.com/tools/migration-redirect-mapper)（ブラウザ内の対応付け・ループ検査）。

差別化仮説: 初期状態・段階ごとの変更・維持すべき到達先を独立入力し、全段階を検査する。初期と最終の両方で成功したURLの中間障害を抽出し、段階の交換を試せる。既存の公開前検査との機能重複はあるが、段階順の比較に集中する。独占性は未確認。

## 起動と操作
index.htmlをブラウザで開く。依存ライブラリ・サーバー不要。サンプルでは初期と最終で3/3到達、中間で3URL失敗。段階2を段階1と交換するとループがなくなり中間障害が1URLに減る。残るページ削除は別の変更が必要。
- 初期ページ300、初期ルール200、変更300、検査100、段階30まで。空白区切り。
- R: ルール設定/置換、D: 削除、P: ページ公開、X: ページ削除。同一段階は一括反映。同じ段階・同じ種類の対象の重複を拒否。
- セル選択で経路、段階交換、検査結果JSON。入力を変えると旧結果を無効化。
- 完全一致のASCIIパスのみ。ルール優先、明示ページのみ到達可能。クエリ・正規表現・キャッシュ・HTTPコード・複数ホスト・実サイト通信なし。登録漏れは実際の404と同義ではない。段階内の非原子的な変更は別段階に分ける必要がある。
- データはブラウザメモリ内、JSON保存は手動。秘密情報・個人情報を入力しないこと。外部APIなし。

## 検証
- `node test.cjs`: 10/10合格（ループ、誤到達、削除・公開、交換、同時反映、入力制限、最大件数など）。
- `python browser_test.py`: ChromiumのインラインHTML起動（環境のfile:制限のため）、経路選択、交換、JSONダウンロード、入力無効化、重複拒否、リセット、390px表示、JS例外/外部HTTP要求ゼロを確認。Python PlaywrightとChromiumはテスト時のみ必要。
- 実環境のリダイレクト、サーバー設定形式、キャッシュ、SEO効果、需要・収益性は未検証。
