# 譜休 / TURNREST
紙譜・電子譜で、演奏者が手を離せる時間に合わせて改ページ位置を設計するMVP。

## 対象と選定理由（2026-11-26調査）
- 対象：編曲者、伴奏者、吹奏楽・室内楽のパート譜担当者。国内ではPiascoreがウィンク譜めくりを提供（https://help.piascore.com/hc/ja/articles/4407316321037 ）。海外では2024年の15人の比較実験でハンズフリー方式が概して好まれた（https://pure.fh-ooe.at/en/publications/to-touch-or-not-to-touch-evaluating-manual-page-turning-modalitie/ ）。譜めくりの課題の根拠であり、本アプリの直接需要や支払意思の証明ではない。
- 競合：LilyPondは休止箇所を考慮した自動改ページをすでに提供（https://lilypond.org/doc/v2.26/Documentation/notation/page-breaking ）。Doricoはパート譜別レイアウト（https://www.steinberg.help/r/dorico-se/6.2/en/dorico/topics/setup_mode/setup_mode_layouts_c.html ）、Piascoreは電子譜の操作を提供。
- 差別化仮説：記譜ソフトやPDFに依存せず、既存の譜段ごとの高さ、手が空く秒数、必須・禁止境界、紙の見開き条件を直接指定し、ページ数別の不足回数・秒数を比較する事前設計に特化。独自性・有料需要は未検証。先行差分300ファイル（51ディレクトリ）と10検索語のコミット検索、直近の制作履歴を確認。全既存READMEの照合は未実施。

## 使い方・計算
index.htmlをブラウザで開く。各行に小節名,高さ（整数単位）,手が空く秒（0.1秒刻み）,自由/必須/禁止を入力。最大120譜段、60頁。奇数頁・偶数頁・毎頁のめくり方式を選択。最終頁はめくらない。譜段順序を保ち、DPで不足回数、合計不足秒、ページ数、頁余白の二乗和を辞書式最小化する。頁数別最良値も表示。サンプルは3頁で不足1回・2秒、4頁で0回・0秒。CSV出力、計画印刷対応。

## テストと制限
- node test.cjs：固定9件、独立全列挙との400条件比較、120段上限処理に合格。
- python browser-test.py：Chromium/Playwrightで初期表示、CSV実ダウンロード、方式変更、旧結果無効化、不正入力、解なし、初期化、390px横幅、JS例外・外部HTTP要求ゼロを確認。環境のfile://制限によりHTMLインライン読み込みで実行。印刷結果・実演奏は未検証。
- 楽譜画像・音符・PDF・反復経路・実際の手の動きは解析しない。高さと空き時間は利用者が実測・確認する。実需・収益性未検証。外部API、通信、追加課金、データ収集なし。
