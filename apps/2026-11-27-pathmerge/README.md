# PathMerge — 納品パス衝突監査 (2026-11-27)

## 対象・選定理由
Web制作会社、デザイン制作、データ移行担当者が、納品フォルダーと既存フォルダーを合流する前に、上書きやファイル・フォルダーの衝突を確認するためのツール。日本語の濁点などのUnicode表記差、大文字小文字、Windows系禁止名も検査する。国内・海外の需要は既存の同期制約・競合から推定し、販売実績や市場規模は未確認。

- 日本: [Microsoft OneDrive/SharePoint 制限](https://support.microsoft.com/ja-jp/onedrive/restrictions-and-limitations-in-onedrive-and-sharepoint)、[同期問題](https://support.microsoft.com/ja-jp/sharepoint/sync/fix-sharepoint-online-sync-problems)。
- 海外: [NameCheck](https://daveco.app/namecheck/) は複数OS向け命名検査・修正、[CrossRename](https://pypi.org/project/crossrename/) はCLIによる名前修正、[ToolsFYI](https://www.toolsfyi.com/tools/text-tools/filename-collision-audit) は名前一覧のNFC・小文字衝突検査、[LucidLink](https://developer.lucidlink.com/labs/unicode-duplicates) はUnicode重複の検出・解消。
- 差別化仮説: 単一フォルダー内の命名検査ではなく、納品元と既存納品先を別々に入力し、階層ごとの合流・ファイル対フォルダー衝突まで確認して、未検出の納品元パスだけを取り出す。名前を自動変更せず、合流前のレビューに特化。競合の全機能や収益性は未検証。
- 重複調査: 専用ブランチのapps一覧と filename / path collision / ファイル名 / PathMerge のコミット検索を確認。JoinDeltaは表データの結合監査であり、本作はファイル階層の監査。全既存ソースの精査は未実施。

## 使い方
index.htmlをブラウザーで開く。共通ルート相対のファイルパスを1行ずつ貼る（/区切り、各2,000行まで、40階層まで）。NFC・小文字化・Windows系の基本禁止名の検査を設定して実行。JSONには両一覧の根拠、TXTには納品元の衝突未検出パスのみ出力。初期サンプルは8件中7件が要確認、1件が未検出。設定・入力変更で結果を無効化。実ファイルにはアクセスせず、入力は送信・永続保存しない。

## テスト
- node test.cjs: 512アサーション合格（固定12件、独立した全ペア比較による生成500ケース）。最大2,000行も確認。
- python browser_test.py: Chromium/Playwrightで同一HTMLのインライン読み込みによる操作、絞り込み、JSON/TXTダウンロード、入力変更・不正入力、設定変更、390px幅を検査。JS例外・外部HTTP要求0件。環境ポリシーのためfile://直接起動は未検証。

## 制限
NFC＋JavaScriptの小文字化は実際のNTFS/APFS等の照合規則と同一ではない。Windows系検査も基本禁止文字・予約名・末尾・構成要素長のみで、完全なOS/クラウド規則、総パス長、空ディレクトリ、シンボリックリンク、権限、内容一致、実際の転送は未検証。異表記フォルダーの合流は保守的に警告する。入力一覧が完全でない場合は衝突を見落とす。未検出は安全保証ではない。個人情報・秘密情報を入力しないこと。外部ライブラリ、課金API、アカウント不要。
