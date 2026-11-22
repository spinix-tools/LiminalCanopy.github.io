# 字幕みはり / JIMAKU MIHARI

既存の動画字幕（SRT / VTT）を、公開前に端末内で点検・修正する日本語対応Webアプリです。index.html をブラウザで開くと操作できます。外部API・ログイン・課金はありません。

## 対象・選定理由
個人動画投稿者、学校・自治体広報、小規模映像制作会社。総務省は2026年10月30日に2025年度の字幕放送実績を公表し、字幕アクセシビリティは継続課題です。ただし放送局の統計はこのアプリの直接的な市場規模ではありません。
- 国内の近接競合: [Klang AI（字幕生成）](https://jp.klang.ai/subtitle-generator/)、[ToolMole（TXT→SRT）](https://toolmole.com/ja/txt-to-srt/)、[ClipGG（字幕変換）](https://clipgg.uk/ja)
- 海外競合: [Subtitle Edit](https://www.nikse.dk/subtitleedit)（無料・高機能）、[Kapwing](https://www.kapwing.com/help/srt-file/)（クラウド字幕編集）。
- 2026-10-30の総務省公表内容に関する[参考資料](https://praze.jp/news/gov-1c57b74a76ec011c8d6cdf9730f824a5/)。

**差別化仮説**: 文字起こしではなく、SRT/VTTの読みづらさ（文字/秒・長い行・短時間表示・重複）だけに集中。点検閾値、個別確認、修正、動画と合わせたプレビュー、点検CSV/字幕書き出しを無料・ローカルで完結。既存製品との部分的な機能重複はあり、顧客需要・収益化は未検証です。

## このGitHub版の機能
SRT/VTT/JSON取込、最大表示速度や問題件数の集計、字幕編集・追加・削除、要確認/確認済フィルター、300ms未満を避ける重複時間短縮、Undo、端末内動画プレビュー、SRT/VTT/CSV/JSON保存、手動でのlocalStorage保存・復元、スマホ表示。

## 検証と注意
- **GitHub版**: GitHubから再取得、HTML内JavaScriptの構文チェックは成功。**GitHub版そのものの実ブラウザ操作テストは未実施。**
- **別途配布の完全版ZIP**: Node.js **13/13**（ランダム300系列を含む）、Chromium UI **26/26**、外部通信・JS例外0件。これらはGitHubの軽量版に対するテスト結果ではありません。
- Chromium環境では file:// / localhost への遷移が拒否されたため、完全版の同一ソースをインライン実行。localStorageは模擬。一般ブラウザでの永続化・直接起動は未検証。
- 出力時、WebVTTの一部メタ情報や識別子は保存しません。元ファイルをバックアップし、実映像と最終照合してください。字幕のアクセシビリティ適合・意味的正確性を保証しません。

**保存先:** hourly-app-lab/apps/2026-11-22-jimakumihari/（mainは不変更）。MIT License。