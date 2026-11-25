# 留置順 / RailNest
2026-11-25 · 鉄道模型専用の留置線割当MVP。index.htmlをブラウザで開くだけで動作（外部依存・通信・登録なし）。

## 市場・選定理由
- 国内：第25回国際鉄道模型コンベンション（2026年8月21–23日）は3万人超の来場を公式発表。https://kokusaitetsudoumokei-convention.jp/
- 海外：NMRAは米国以外にもカナダ、英国・欧州、豪州・NZの会員地域を持ち、2025年7月19–20日にNational Train Showを開催。https://www.nmra.org/membership https://www.nmra.org/events/2025-national-train-show
- 競合：TOMIX NXF2023はレイアウト設計・距離計測、Trackplannerは線路設計と有効長チェック（調査時は近日公開と表示）、JMRI Operationsは留置線・列車割当（基本は1列車1留置線）。https://layouter.tomytec.co.jp/layouter/ https://trackplanner.io/ja https://www.jmri.org/help/en/package/jmri/jmrit/operations/Operations.shtml
- 対象：N/HO等の運転会主催者・自宅レイアウト愛好家。差別化仮説：既設の片側入口留置線を複数編成で共有し、到着順・出発順・既占有長・優先度から、出発時に手前の編成を移動する必要がない静的割当を逆算。直接需要・支払意思・独自性の網羅的調査は未検証。

## 操作・計算
留置線は名称,有効長mm,既占有mm,入口側既存編成の出発順位（空線は末尾2項目0）。到着編成は名称,長さmm,出発順位,優先度。小さい順位ほど早く出発。同じ線で同順位は禁止。最大5線・8編成。既存占有は余白込み、新規は各編成に指定余白を加算。全到着後に出発するモデル。分枝限定付き全列挙で優先度合計、次いで配置数を最大化（同点は探索順）。先着順の最初に入る線への割当と比較。CSV・印刷対応。既存編成内部の順序、分岐器・入換経路・線路間干渉、実物での適合は対象外。実鉄道には使用不可。

## 検証
`node test.cjs`：固定8件、独立全列挙300条件、最大5線8編成に合格。サンプルは3/4本・優先度11から4/4本・19へ改善。`python browser_test.py`：ChromiumでHTMLをインライン読み込み（環境でfile:が拒否されたため）、サンプル、CSV実取得、入力変更時無効化、不正入力、リセット、配置不可、390px幅、JS例外・外部HTTP要求なしを確認。ブラウザテストはPython PlaywrightとChromiumが必要（アプリ自体には不要）。実機運転・実印刷・収益性未検証。

## 重複確認
専用ブランチのapps一覧と「鉄道模型」「留置線」「staging」「railroad」のコミット検索を確認。該当コミットなし。全READMEは未精査。
