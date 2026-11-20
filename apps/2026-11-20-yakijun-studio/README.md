# 焼き順スタジオ / YAKIJUN STUDIO

2026-11-20 制作。家庭の複数種類のパンを1台のオーブンで焼くための、無料・日本語のオフラインWebアプリ。配合、焼成逆算、作業衝突検査、焼き順全探索、SVG時系列、CSV・JSON入出力、印刷を実装。

## 対象と根拠

家庭のパン愛好者・小さなパン教室・マイクロベーカリー。クックパッド（2025-10-03）調査では、2025年に「初めて」つくれぽの上位30レシピに占めるパンの割合が26.1%だった。ただし対象の限定された指標でアプリ需要を示さない。英国AHDB（2026-03-19）は2025年の家庭ベーキング機会が前年比7%減と報告し、市場の一律成長を主張できない。

- https://prtimes.jp/main/html/rd/p/000000332.000027849.html
- https://ahdb.org.uk/news/baking-trends-savoury-baking-and-scratch-cooking-boost-dairy-consumption

## 競合と差別化仮説

Flourwise (https://flourwise.com/)、SourdoughGuru (https://sourdough.guru/)、Sourdough and Bread (https://sourdoughandbread.com/sourdough-bake-planner) は配合計算・工程逆算を提供する。本アプリは「1台のオーブンで複数生地を焼く」「混合作業が同時に始まらない焼き順を比較する」に焦点を絞る。検証済みの差別化・収益化ではなく仮説。

## 成果物と検証

完全なMVP・テスト・詳細READMEは同じ apps/2026-11-20-yakijun-studio/ に格納する。index.html と他のCSS/JSファイルを同じディレクトリに置いて起動。単体テスト 27/27 合格（200ランダム条件を含む）。Chromium インライン展開テスト24/24合格（本物のlocalStorageは未検証）。発酵時間は手入力で温度補正なし。設備容量・食品衛生・実焼成性能を保証しない。

開発内容はMIT License。外部APIなし。個人情報の外部送信、追加課金なし。
