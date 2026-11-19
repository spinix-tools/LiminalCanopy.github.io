# 字幕定規 / JIMAKU JOGI

公開前の字幕を「読める秒数」と「スマホ画面の余白」の両方からチェックする、端末内完結のWebアプリ。index.html をブラウザで開くだけで使用可能。

## ターゲット
日本語ショート動画制作者、教材・講座動画担当者、字幕編集のフリーランス。既作「文字がこ」（ソフトウェアUI翻訳）とは異なり、動画字幕のタイムコードと表示領域を対象とする。

## 市場と選定理由（2026-11-19確認）
- **日本**：サイバーエージェントの2026-03-09発表では、2025年の国内動画広告市場は8,855億円、縦型動画広告需要は2,049億円。動画制作者の増加の傍証であり、字幕校正アプリの市場規模を示すものではない。https://www.cyberagent.co.jp/news/detail/id=33050
- **海外**：IABの2026-05-05発表では、2026年の米国デジタル動画広告支出は800億ドル超と予測。字幕品質検査の支払需要を直接示すものではない。https://www.iab.com/news/u-s-digital-video-ad-spend-to-surpass-80b-in-2026/
- **国内競合**：NekoMoji（字幕生成とAI品質チェック、有料Gemini API利用機能あり）、AI Telop Generator（Premiere向け生成・AI補正）。https://nekomoji.app/ / https://ai-telop.com/
- **海外競合**：SRT Creator（速度・行長・時間のライブ校正と編集）、CueCheck（ブラウザ内SRT/VTT速度検査）、SubtitleWave（動画・波形とQA）。基本機能に新規性はない。https://www.srtcreator.com/ / https://cuecheck.dpdns.org/ / https://subtitlewave.app/srt-editor
- **参考規格**：Netflix Japanese Timed Text Style Guideには同サービス向けの上限4文字/秒が記載されている。ただし本アプリのプリセットはNetflix納品適合を意味しない。https://partnerhelp.netflixstudios.com/hc/en-us/articles/215767517-Japanese-Timed-Text-Style-Guide

## 差別化仮説
SRT/VTTのタイムコード・日本語の読み速度・実フォント幅・画面右/上下の仮想UI占有領域・次字幕へ重ならない自動延長を**一画面で**点検したい小規模制作者がいる、という仮説。SNS安全帯は利用者が調整する非公式の目安で、事業者が公認したガイドライン値ではない。顧客発見・課金意向・需要実証は未実施。

## 実装
1. SRT/WebVTTローカル読込（最大2MB、2000キュー）、デモ字幕、キュー追加/削除/時刻と本文の編集、Undo
2. 文字/秒（CPS）、最短/最長表示、行長・行数、字幕間隔・重複、描画幅のチェック
3. 9:16と16:9の疑似背景プレビュー、シーク・再生、右/上下の仮想UI安全帯
4. 空いている時間の範囲で表示時間を自動延長、全体タイムシフト
5. 編集済SRT/VTT、UTF-8 BOM付き検査CSVを保存
6. 外部通信・課金・サーバー処理・分析タグ・localStorageなし。字幕はメモリ内のみ

## 使い方と注意
index.html を直接開き、デモまたは自身の字幕ファイルを読み込む。「要確認リスト」から問題の字幕へ移動し編集する。延長は次キューと衝突する場合に停止する。編集後にSRT/VTTを出力する。

WebVTTのキューID・NOTE・STYLE・位置指定や、SRTの元番号はラウンドトリップで保持しない。本文の書式タグは出力に残すがプレビューでは除去。動画・音声の入力、翻訳、字幕焼き込み、実映像との同期は非対応。実SNSのUI安全帯・可読性・規格適合性は保証しない。

## 検証
- GitHubから再取得したHTMLのエンジンに対し、同梱のengine.test.cjsのsuiteをV8で実行：**938 / 938合格**（300乱数ケースのSRT/VTT往復、衝突なし時間延長、CPS、時刻移動など）
- HTMLのアプリ用JSをV8で構文評価し、軽量DOMモック上でデモ読込、追加/Undo、全消去、プリセット変更、延長、時刻移動、レイアウト切替、SRT/VTT/CSV出力など**11 / 11合格**
- **未検証**：Node.js CLIからの単体テスト実行、実ブラウザでの描画・ファイル保存、実動画での音声同期、実ユーザーによる使いやすさ。Node 18+向けに node engine.test.cjs を同梱（外部依存なし）

## 保存先・ライセンス
spinix-tools/LiminalCanopy.github.io の hourly-app-lab/apps/2026-11-19-jimakujogi/ のみ。mainと既存サイトを変更しない。MIT License。新規API課金や個人情報の収集なし。
