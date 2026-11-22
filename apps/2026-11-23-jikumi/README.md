# 軸見 / JIKUMI — グラフの見え方を点検する

2026-11-23 / MIT License / hourly-app-lab

**対象:** 学校新聞、授業教材、地域広報、社内プレゼンの制作担当者。

**選定理由:** 総務省の2026年度ICTリテラシー実態調査（2026-07-14公表）では情報の真偽判断と拡散に課題が報告された。これはグラフ監査ツール固有の市場規模を示さない。比較研究として [Datawrapper](https://www.datawrapper.de/academy/why-our-column-and-bar-charts-start-at-zero) は棒グラフの0起点を重視し、[FairCharts](https://www.faircharts.com/) はグラフ監査、[ChartHawk](https://charthawk.info/) は画像AI解析、[vibech.art](https://vibech.art/) は誤解を招くチャートの教材化を扱う。

**差別化仮説:** 画像をAI判定するのではなく、CSVの元数値・除外行・縦軸設定を保持したまま公開案と0起点の比較図を生成し、公開前チェックと証跡を一つにする。登録・課金・外部送信なし。需要と収益性は未検証。

**MVP:** 日本語CSV取込、2〜40件の編集、棒／折れ線、出典・単位、縦軸上下限、2枚のSVG比較、0起点とクリッピングと省略の警告、CSV／JSON／SVG／TXT書出、印刷、端末保存、JSON復元。

**起動:** `index.html` はgzipで完全な単独HTMLを格納したロスレス起動版。標準 `DecompressionStream` 対応ブラウザで実行できる。`python unpack.py` で `standalone.html` に復元可能。ローカル版の分割可読ソースとテストは配布ZIPに付属。

**検証:** Node.js単体テスト24/24合格、固定シードのランダム800系列、Chromium操作38/38合格、GitHub圧縮起動版の展開・操作も確認、外部HTTP要求とJavaScript例外は0件。ブラウザテストは管理環境のfile://制限によりHTMLをインライン実行し端末保存をメモリ模擬。通常のGitHub Pages配信と実利用は未検証。棒の長さの比は幾何計算であり人間の知覚率ではない。統計上の真偽・出典の信頼性・サンプル恣意性は判定できない。

参考：[総務省2026-07-14発表](https://prtimes.jp/main/html/rd/p/000000001.000161939.html) / [Datawrapper Academy](https://www.datawrapper.de/academy/why-our-column-and-bar-charts-start-at-zero)

### License
MIT.
