# 字秒 / JIBYOU
**字幕の読みやすさを、時間でみる。** SRT / WebVTTの公開前QC。対象は日本語の学校、自治体、NPO、個人の動画制作者。
完全ローカル・登録不要・外部APIなし。GitHub版の index.html + payload.js は**完全版HTMLのgzipロスレス格納**で、 `python3 unpack.py` で可読なstandalone.htmlに復元できます。

## できること
字幕読込・編集・追加・削除・開始時刻整列、読速(字/秒)・1行文字数・行数・最短表示・字幕間隔の5つのしきい値、重複/逆転/空欄などの検出と一覧ジャンプ、安全な重複解消と表示延長、Undo、字幕と端末選択動画のプレビュー、基準件数比較、SRT/VTT/CSV/JSON保存、印刷、ブラウザ内部の自動保存。
VTTの細かなスタイル・リージョン・音声との厳密同期は対象外。規格適合を保証しません。

## 選定・需要と競合（2026-11-23）
日本：総務省2026-10-30公表の2025年度字幕放送等の実績は放送アクセシビリティへの継続的な取り組みを示す。ただし本アプリの市場規模ではない。
https://jpjj.jp/articles/captioned-broadcast-2025-results/
W3C WCAG 2.2 の1.2.2は適用対象の事前収録メディアに字幕を求め、音声だけでなく重要な非言語音も含む。
https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html
国内：NekoMoji（https://nekomoji.app/）、字幕Edit（https://apps.apple.com/jp/app/%E5%AD%97%E5%B9%95edit/id6826184200）。
海外：Subtitle Edit（https://github.com/SubtitleEdit/subtitleedit）、SubtitleWave（https://subtitlewave.app/srt-editor）。
**差別化仮説：** 字幕制作用ソフト全体ではなく納品前の短時間QCに絞り、調整可能な日本語の参考値と検出件数の前後比較、検品CSV、完全ローカル動作を一画面に統合する。直接競合は強く、需要・収益性・独自性は未検証。

## テスト（2026-11-23）
Node.js単体 **31/31成功**、固定シードランダム **1,000系列**成功。完全版Chromium v144/Playwright操作 **37/37成功**（HTML/CSS/JSの同一ソースをインライン実行、localStorageをメモリ模擬）。HTTP要求・JS例外は0件。GitHub配布ローダーは展開と可読ソースへの一致を検査。
制限：file://直接起動、実動画の音声同期、全ブラウザでの互換性は未検証。数値的に問題がなくても音声・話者・効果音・意味は人が確認してください。
追加のOpenAI API、有料サービス、秘密・個人情報の収集・外部送信はありません。MIT License。
