# 字幕すきま / JIMAKU SUKIMA

日本語字幕の SRT / WebVTT を、登録やサーバー送信なしで確認する静的Webアプリ。2026-11-21制作。

## 対象・選定理由
小規模映像制作、地域メディア、教育・自治体広報、字幕校正担当者。2026-10-30公表の令和7年度字幕放送実績では、在京キー5局の字幕放送時間の割合が71.7%と報告されており、字幕品質管理は継続的な業務ニーズが見込まれる。これは放送市場の数字であり、Webアプリの顧客数を示すものではない。
- https://jp-reports.com/en/articles/01M679SVX795DMHKCFNG57FTQ0/

## 競合・差別化仮説
国内の[SubToolDesk](https://subtooldesk.com/ja/)はローカル字幕変換、海外の[Amara](https://support.amara.org/support/solutions/articles/248324-warning-messages-in-the-editor)・[CueCheck](https://cuecheck.dpdns.org/)は読速や行長・表示時間を検査する。単なる字幕チェッカーは既存。
本MVPは**日本語の全角換算幅と、読速不足分・次字幕までの空き時間・延長可能性の同時表示**を差別化候補とする。禁則に配慮した改行候補と、他の字幕に重ならない条件付き延長を一画面で実行する。独自性・需要・収益性は仮説段階。

## 機能
SRT/VTTの入力と読み込み、全角換算読速・行数・行長・長短・字幕間隔・重なりの監査、閾値編集、問題行フィルタ、テキストと時刻の手動修正、改行候補、一括安全延長、Undo、SRT/VTT/CSV書き出し。外部API、課金、アカウント、個人情報収集、外部送信なし。

参考初期値（日本語横書き）: 13全角/行、2行、4全角/秒、最短0.5秒（出典[Netflix](https://partnerhelp.netflixstudios.com/hc/en-us/articles/215767517-Japanese-Timed-Text-Style-Guide)）。正式なNetflix日本語納品形式はIMSC 1.1であり、本MVPはNetflix納品適合性を保証しない。

## 検証 / 制約
ローカルフル版では Node.js 33/33 テスト合格、固定シード400ケース、Chromium 37/37操作テスト合格、外部通信・例外ともに0。実行環境でlocalhostがブロックされたため、Chromiumは同じHTML/CSS/JSをインライン展開して検証した。実機のfile://起動、他社字幕プレーヤー互換、音声との同期は未検証。

MIT。ローカルで解凍して index.html を開く構成。