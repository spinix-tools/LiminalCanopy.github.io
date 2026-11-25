# 鍵域 / KeyScope

ショートカットの設計段階で、グローバル・アプリ・モード間の競合を検査するブラウザツール。対象は開発者、ショートカットを多用するクリエイター、社内ツール管理者。

## 選定理由・競合（2026-11-26確認）
- 日本：日本語の[VS Code設定事例](https://qiita.com/12345/items/64f4372fbca041e949d0)でIMEによる入力横取り・起動条件が問題に。[macOS設定事例](https://zenn.dev/hero_776/articles/2025-keyboard-setting)では複数のキーボードツールを併用。需要の定性的証拠であり市場規模ではない。
- 海外：[Stack Overflow 2026調査](https://survey.stackoverflow.co/2026/technology/data/dev-ide)のIDE設問13,193回答中、VS Code利用70.9%。[Rider](https://www.jetbrains.com/help/rider/Keyboard_Shortcuts_Troubleshooting.html)もOSとの競合を解説。
- 競合：[PowerToys](https://learn.microsoft.com/ja-jp/windows/powertoys/keyboard-manager)は実際の再割当、[VS Code拡張](https://github.com/rhslvkf/keybinding-conflict-scanner)は拡張内の競合検出、[KeyCombiner](https://keycombiner.com/keycombiner/)は検索・可視化・空きキー確認。
- 差別化仮説：複数アプリの設定を変更する前に、排他的モードと全域を明示し、完全一致と連続入力の前方一致を区別して、代替候補を1件ずつ適用・再検査できる。類似機能は既存製品にもある。導入負担や支払意欲は未検証。

## 使い方
index.htmlをブラウザで開く。外部依存・通信なし。1行につき「アプリ | モード | キー | 操作名」。全域は * | *、アプリ全体は アプリ | *。最大200行・候補50件・連続3打。Modは対象OSに合わせてCtrlまたはMetaになる。代替ボタンで1行変更し再検査、JSON出力・印刷も可能。サンプルは架空。

## 検証・制約
- `node test.cjs`：固定12/12合格、200件の全組合せ19,900件検査を含む。
- `python browser_test.py`：Chromiumのインライン読み込みで初期2競合、候補適用、JSON実ダウンロード、OS変更、無効入力、HTML安全表示、リセット、390px幅、JS例外・HTTP要求ゼロを確認。ファイルURLは環境の管理ポリシーで未検証。
- 競合は入力された範囲の候補であり、OS予約・IME・物理配列・アプリ内の優先順位・実行時挙動を保証しない。アプリ名・モード名は大文字小文字を無視し、異なるアプリ・同一アプリの異なるモードは同時有効でないと仮定。候補は独立評価。キー監視・設定書き換え・個人情報収集なし。
- 重複確認：専用ブランチの227ディレクトリ名と直近の会話内成果物を確認。全READMEの照合は未実施。
