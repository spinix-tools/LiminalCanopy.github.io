# 字幕ものさし / JIMAKU MONOSASHI

2026-11-20 / Offline-first Japanese subtitle QA MVP.

## 対象と仮説
対象：国内のYouTube・教育・社内研修・公共広報の字幕制作者。2026-10-02発表の矢野経済研究所調査では2025年度の日本の動画コンテンツ主要5市場は1兆1,474億円（前年比102.1%）。字幕QAの直接需要を示す数字ではない。海外ではW3C WCAG 1.2.2が収録済み動画のキャプションを求めている。

競合：[Vrew](https://vrew.ai/ja/feature/srt-export/)（自動字幕・SRT出力）、[Rast Creative](https://rastcreative.com/en/tools/srt-subtitle-checker/)（SRT/VTTチェック）、[Subtailor](https://subtailor.com/fix-subtitles/)（字幕不具合修正）。同種の無料サービスは既に存在し競争は強い。

差別化仮説：日本語の全角・半角の簡易字幅換算、禁則文字、処理を見送った理由の可視化、無理な自動修正を避けるUndo付きワークフロー。対面ユーザーテスト・継続率・支払意思は未検証。

## 機能
SRT/VTTの読み込み・貼り付け、字幕の時刻と本文編集、行幅・読速・表示時間・重複・禁則チェック、問題フィルター、改行整形、重複の安全側修正、Undo、SRT/VTT/CSV書き出し。ローカルのみで動作しAPIキー・課金・個人情報送信なし。ブラウザでindex.htmlを開いて使用する。

## 検証と制約
ローカルの分割ソース版（チャット添付ZIP）をNode.jsで**28/28**、Chromiumで**29/29**操作検証、ランダム条件はタイムコード往復500ケース・重複修正400ケースを確認した。ブラウザ管理環境ではfile://が禁止されたため、同一ソースをインライン展開してUIテストを実施した。

**GitHubのこのフォルダのindex.htmlは公開用の単一ファイル構成で、添付ZIPの分割ソース版とは構成が異なり、この単一ファイル版のE2Eテストは未実施。** 重要な字幕は原本を保持して動画・音声と照合すること。スタイル設定や特殊VTTブロックの完全維持、放送/Netflix/WCAG適合は保証しない。

## 出典（2026-11-20に確認）
- [矢野経済研究所（2026-10-02）](https://www.yano.co.jp/press-release/show/press_id/4196)
- [Vrew公式](https://vrew.ai/ja/feature/srt-export/)
- [Rast Creative](https://rastcreative.com/en/tools/srt-subtitle-checker/)
- [Subtailor](https://subtailor.com/fix-subtitles/)
- [Netflix 日本語字幕ガイド](https://partnerhelp.netflixstudios.com/hc/en-us/articles/215767517-Japanese-Timed-Text-Style-Guide)
- [W3C WCAG字幕](https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html)
