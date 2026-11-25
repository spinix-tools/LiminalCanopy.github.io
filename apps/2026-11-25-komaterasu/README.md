# コマ照 / KOMA TERASU

ネガのコマIDとスキャン名の順序、目視確認済み対応、除外情報から、可能な1対1対応を漏れなく絞るローカルWebアプリ。画像・EXIFの読み取りやファイル改名はしない。`index.html` をブラウザで開く。依存・アカウント・外部通信なし。

## ターゲット・選定理由（2026-11-25）
- フィルム写真愛好者、写真教室、小規模スキャン作業者。欠落コマや余分なスキャンで連番がずれる場面を想定。
- 日本：FilmFocusの2025年調査は有効1,337回答（2026-08-09公開）。富士フイルムはフィルムのデータ化サービスを提供。需要の傍証であり、本アプリの市場規模ではない。
- 海外：ILFORDの2024年調査は110超の国から14,000超の回答（2025-04-24公開）。Film Logbookのガイドも空白・欠落コマの照合問題を扱う。
- 競合：Negative Lab Proはフィルム固有メタデータ、Framelatchはファイル名パターン・逆順とExifTool CSV、Film Logbookは撮影記録とスキャンの目視照合。Anchorframeは日時・位置情報の復元。
- 差別化仮説：写真をアップロードせず、順序・確認済み対応だけから欠落／余分を含む全候補を数学的に可視化し、条件内の一意性と実物確認を区別する。競合の全機能は未検証。実需要・支払い意思も未検証。まず10人程度に実際の1ロールで試用してもらい、照合時間と誤対応を比較する。

## 操作・計算
1. 両一覧を実際の順序で入力（各100件まで）。先頭 `!` で確認済みの除外。IDの重複・`|`・`!` は不可。
2. 目視確認した組を `コマID | スキャン名` で入力。逆順なら反転。各確認区間で許容する追加の欠落＋余分のペアを0〜2組に設定。
3. 計算し、両方向の候補・未対応可能性を確認。CSVまたは印刷で保存。初期例は3通り、`04 | scan002.jpg` を追記すると1通り（許容0）。
4. アンカー間の残り件数 n,m に対し、対応数 t を max(0,min(n,m)-許容数) から min(n,m) までとし、C(n,t)C(m,t) を合計。区間ごとの通り数を掛け合わせる（BigInt）。個々の候補は前後で確保可能な対応数で判定。順序を保つ1対1対応が前提で、並び替え・複数スキャンの同一コマへの対応・誤ったアンカー・許容超過は推定しない。候補は各行の周辺集合であり、任意の組み合わせが同時に成立するわけではない。

## 検証
- `node test.cjs`：独立した順序保持対応の全列挙222ケースで総数・双方向候補・未対応可能性が一致。固定8アサーション（重複・空ID・矛盾・未知アンカー・CSVエスケープ・最大100件など）合格。
- `python browser-test.py`：Playwright + Chromium（/usr/bin/chromium）。サンプル、アンカー追加、CSV実ダウンロード、許容変更、逆順矛盾、HTML安全表示、初期化、390px幅に合格。JS例外・HTTP要求0件。環境のfile://制限によりHTMLをset_contentで実行。実物ネガ・実機印刷は未検証。
- 重複確認：mainとの比較で返った300ファイル、フィルム／ネガ／film／scan／frameのコミット検索（各0件）、直近の会話履歴。全既存READMEの精査は未実施。

## Sources
- https://www.film-photo.net/articles/film-survey-2025-result
- https://fujifilmmall.jp/conversion/scan_film/
- https://www.ilfordphoto.com/film-photographers-survey-2024-results/
- https://filmlogbook.app/guides/how-to-match-film-notes-with-scans/
- https://www.negativelabpro.com/guide/film-metadata/
- https://framelatch.app/help
- https://anchorframe.app/

English: Enter ordered negative IDs and scan filenames, prefix confirmed omissions with !, and add verified pairs with |. The tool enumerates the possible monotone one-to-one matchings analytically, not by inspecting images. Uniqueness is conditional on the input assumptions. Export a review CSV; no files are modified.
