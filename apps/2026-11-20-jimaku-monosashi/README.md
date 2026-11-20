# 字幕ものさし / JIMAKU MONOSASHI

**2026-11-20 制作 / Offline subtitle QA MVP**

日本語 SRT / WebVTT 字幕の「行幅・読速・時間」の検査、手動編集、安全側の一括整形を一画面で行う無料ブラウザーアプリ。`index.html` を開くとサンプルで動作します。サーバー・API・登録・ビルドは不要。JS/CSS はローカルの相対ファイルです。

## ターゲットと選定理由

対象：YouTube・学校授業・企業研修・自治体広報の日本語動画を制作する人、既存の文字起こし字幕を公開前に点検する人。国内では矢野経済研究所が **2026-10-02** に2025年度の動画コンテンツビジネス主要5市場を **1兆1,474億円、前年比102.1%** と公表した（※本アプリの直接市場規模ではない）。海外ではW3CのWCAG 2.2 [1.2.2 Captions (Prerecorded)](https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html) が収録済みの音声付き動画へのキャプションを求めており、制作・品質検査の共通課題がある。

## 競合・差別化仮説

- 国内 [Vrew](https://vrew.ai/ja/feature/srt-export/)：自動文字起こし、修正、SRT書き出し。
- 海外 [Rast Creative Subtitle Checker](https://rastcreative.com/en/tools/srt-subtitle-checker/)：ブラウザでSRT/VTTの重なり・読速・行幅を点検。
- 海外 [Subtailor Fix Subtitles](https://subtailor.com/fix-subtitles/)：複数形式の重なり修正、重複除去、ブラウザ内処理。
- 日本語制作上の参考：[Netflix Japanese Timed Text Style Guide](https://partnerhelp.netflixstudios.com/hc/en-us/articles/215767517-Japanese-Timed-Text-Style-Guide) は通常の日本語字幕で全角13字/行、4字/秒などを案内。**本アプリの「厳しめ」は参考値であり、Netflix規格適合や納品可能性を保証しない**。

**差別化仮説：** 動画編集・自動音声認識はせず、「公開直前の日本語字幕QA」に絞る。全角1・半角0.5の字幅換算、句読点の行頭禁則を考慮した2行整形、無理な自動改行・短時間化を保留にして表示、変更理由とUndo、チェック結果CSVを統合する。既存の無料字幕QAとの競争が強く、仮説は未検証。10人程度の字幕制作者に対する比較タスクで所要時間・修正の見落としを測る必要がある。

## 実装機能

1. SRT / WebVTTファイル読込（UTF-8・BOM・CRLF）、本文貼り付け、サンプル。読み込み不正時は前の文書を保持。
2. 行幅・秒あたりの字幅・最低/最高表示時間・字幕同士の重複/逆転・空行・行数・行頭/行末禁則を検査。日本語標準/厳しめ/英語一般の目安選択としきい値変更。
3. 字幕タイムライン、問題箇所フィルター、選択字幕の開始/終了時刻・本文編集、プレビュー。
4. テキストを削除しない2行整形。収まらない文章は自動処理せず保持。重なりは「前の字幕の終了のみ短縮し500ms以上残す」条件で修正できる箇所のみ処理。
5. 変更履歴と最大25回Undo、SRT・WebVTT・診断CSVダウンロード。CSVは式注入対策で特殊先頭文字をエスケープ。

### 実行とテスト

- 開く：`index.html`（同一フォルダに `engine.js`, `app.js`, `style.css` が必要）。
- ロジック：`node --test engine.test.cjs` — **28 / 28 合格**（SRT/VTT入出力往復ランダム500件、重なり安全性ランダム400件を含む）。
- UI：`python browser_test.py` — **Chromium 29 / 29 合格**。SRT/VTT/CSV実ダウンロード、読込、Undo、修正、画面注入テスト、390pxモバイル表示を検査。
- `file://` を管理環境のChromiumがブロックしたため、ブラウザテストは同じHTML/JS/CSSファイルを **インライン展開** して実行。ローカルファイル直起動と一般環境での保存は未検証。

## 制限・安全性

- 表示字幅の換算は簡易モデルで、実フォント・異体字・合成文字・字幕レンダラの表示幅とは異なる。禁則判定も基本的な字種のみ。SRT/VTTの高度なタグ・キュー設定・STYLE/REGIONを完全には保持しないため、複雑なファイルは原本をバックアップする。
- 自動改行は2行のみ対応、語句切りや意味上の切れ目は完全には判断しない。自動時刻修正は音声・映像の同期を検証しない。人手による原音照合が必須。WCAG準拠判定ツールではない。
- 入力データはブラウザメモリ内のみで扱い、ネットワーク送信・端末永続化・追跡はしない。動画・音声アップロードや音声認識は**未実装**。利用に新たなAPIキーや課金は不要。

## ディレクトリ

`index.html` 画面 / `style.css` 表示 / `app.js` 操作 / `engine.js` 計算・読み書き / `engine.test.cjs` 単体テスト / `browser_test.py` UI E2E / `desktop.png`, `mobile.png` 実行画面 / `LICENSE` MIT。

## 調査出典（確認日 2026-11-20）

- 矢野経済研究所（2026-10-02） https://www.yano.co.jp/press-release/show/press_id/4196
- Vrew公式 https://vrew.ai/ja/feature/srt-export/
- Rast Creative https://rastcreative.com/en/tools/srt-subtitle-checker/
- Subtailor https://subtailor.com/fix-subtitles/
- Netflix 日本語字幕ガイド https://partnerhelp.netflixstudios.com/hc/en-us/articles/215767517-Japanese-Timed-Text-Style-Guide
- W3C WCAG 2.2 https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html
