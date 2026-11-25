# 駒尺 / KOMA SHAKU
2026-11-25 — コマ撮り・2Dアニメーションの撮影済みポーズ列を、指定した尺・同期位置に合わせて再配分するローカルWebアプリ。

## ターゲット・選定理由
自主制作、映像教育、小規模ストップモーション制作。国内ではSKIPシティの企画展（2026-05-02〜09-27）、FabCafe Kyotoの2024-04-27の入門講座。海外ではモントリオールのCasteliersの2026-03-05〜07の無料講座3回が満席表示。教育・制作コミュニティの存在を示すが、アプリの有料需要や市場規模は未検証。
- https://www.skipcity.jp/event/vm/komadori/
- https://fabcafe.com/jp/events/kyoto/stopmotion
- https://festival.casteliers.ca/en/spectacle/stop-motion-workshops/

## 競合・差別化仮説
Dragonframeはタイムライン編集、X-Sheet、音声トラックを提供。StopSheet Offlineは手入力の露出表とCSV/PDF出力。virt.toolsのAnimation Exposure Calculatorは一定の保持フレーム数から尺を計算。駒尺は既存のポーズ順を保持したまま、個別の最小・最大保持、固定終了フレーム、変更抵抗から逆算する。競合の全機能・特許は未調査、独自性は仮説。
- https://www.dragonframe.com/ja/dragonframe-software/
- https://apps.apple.com/gb/app/stopsheet-offline/id6794541209
- https://virt.tools/tools/animation-exposure-calculator/

## 起動・仕様
index.htmlをブラウザで直接開く。サンプルを編集して最適化。CSV・印刷・名称のみのタイミング再生に対応。1〜60ポーズ、目標1〜600f、整数FPS1〜60。DPで Σ weight × (new−old)^2 を厳密最小化。固定終了は1始まりの累積最終フレーム。解なしは明示。サンプル16→20f、固定終了10/20f、提案[2,4,4,3,3,4]、コスト7。画像・音声解析、動画書き出し、画質や演技評価はなし。外部API・通信・永続保存なし。

## テスト
`node test.cjs`：固定7件、独立全列挙400件、60ポーズ/600f上限、全合格。`python browser_test.py`：ChromiumでHTMLインライン読込（環境のfile://制限のため）、再生・スクラブ、CSV実ダウンロード、不正入力・解なし、旧結果無効化、リセット、390px幅、JS例外・外部HTTP要求0件を確認。実制作・実機印刷・収益性は未検証。ブラウザテストはPython PlaywrightとChromiumが必要（アプリ自体は依存なし）。
