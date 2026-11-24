# 譜めくり間 / FUMEKURI
2026-11-24制作。演奏用楽譜の改ページ位置を、実際に手を離せる秒数とページ容量から計画する無料・登録不要のWeb MVP。

## 対象・選定理由
吹奏楽・室内楽の演奏者、伴奏者、楽譜制作担当。日本のピティナ2025年協会データは会員17,919名、イベント参加100,239組。海外のABRSMは2026年にも世界向け音楽教育・試験を展開。いずれも周辺需要の指標で、アプリ固有の市場規模や有料需要は未検証。
- https://corporate.piano.or.jp/info/data.html
- https://www.abrsm.org/en-gb

## 競合・差別化仮説
日本のPiascoreはウィンク譜めくり、海外のforScoreは半ページ表示や自動めくり、MuseScoreは手動改ページ、LilyPondは休止を使った最適ページめくりを提供。最適改ページ自体は既存技術。差別化仮説は、楽譜データや記譜言語なしで段の高さと自由時間を入力し、指定ページ数内の不足回数・秒数を可視化し、組版ソフトに渡す指示表を出すこと。日本語の軽量補助ツールとして検証する。競合・市場調査は2026-11-24時点。
- https://help.piascore.com/hc/ja/articles/4407316321037
- https://forscore.co/kb/half-page-turns/
- https://forscore.co/kb/autoturn/
- https://handbook.musescore.org/en_gb/formatting/pages-and-vertical-spacing
- https://lilypond.org/doc/v2.24/Documentation/notation/page-breaking

## 使い方・仕様
index.htmlをブラウザで開く。最大120段、60ページ。段ラベル,高さ,直後の自由秒数を1行ずつ入力し、配置を計算。見開き開始左右・単ページを選択。動的計画法で不足回数、不足秒数、ページ数、空き高さの二乗和を辞書順に最小化。詰め込み方式との比較、改ページ指示、CSV、印刷、端末保存に対応。サンプルは4ページのまま不足2回/3.5秒→0回/0秒。外部通信・API・有料サービスなし。個人情報は入力しないでください。

## 検証と限界
Node.js: 固定10チェック、独立全探索との1200ケース照合に合格。Chromium: 初期表示、上限エラー、変更時の結果無効化、閲覧方式、HTMLエスケープ、模擬保存・復元、CSV、390px幅に合格、JS例外/HTTP(S)要求0件。管理環境のfile://遮断のためインライン実行・保存模擬。実機での保存永続性と演奏は未検証。段の分割・反復・PDF入力・実際の楽譜組版は対象外。最適性は固定順序・高さと入力時間のモデル内のみ。

既存apps一覧と関連8件のREADMEを確認。過去の練習メトロノーム・舞台進行・音声ループ・冊子面付けとは用途が異なる。全既存ソースの照合は未実施。ローカル同梱テストは `node test.cjs` と `python browser_test.py`（Chromium/Playwrightが必要）。
