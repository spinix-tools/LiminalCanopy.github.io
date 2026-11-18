# はぎれ座 / HAGIREZA (GitHub単体HTML版)
2026-11-18 制作。**このフォルダは実際に利用できる独立単体HTML版**です。`index.html`をブラウザで開いてください。課金・外部API・アカウント・個人情報の外部収集はありません。

## 対象・需要
手芸教室、ハンドメイド作家、端切れで布小物を作る人。GMOペパボの2025-11-13のminne動向では日用品・ハンドメイド需要を報告。Eurostatの2026-11-12公表値は2024年EU繊維廃棄物約230万トン。ただしこのアプリ固有の需要・収益性を証明する数字ではありません。

## 競合
国内「布どり」(https://apps.apple.com/jp/app/id6813884540)、海外PatternNest (https://madegrain.com/patternnest/)、ScrapFit (https://scrapfit.webbe-b.com/) は生地計算・型紙配置・端切れ/傷の配置に対応する強い競合。

## 差別化仮説
日本語の布・傷・パーツ寸法をカンマ区切りで入力し、布の傷・回転方向・裁断間隔を避けた複数端切れへの割当をオフラインで試し、CSV・実寸SVGに出力できる入口として使えるか。優位性は未検証。

## GitHub版の機能
複数布・傷の登録、パーツ枚数・回転許可、8通りの貪欲配置、未配置表示、CSV・SVG・JSON入出力、localStorage保存。実物の裁断前に現物確認を。

## フル版・テスト結果
同日制作のフル版は別途配布されたZIP（index.html, style.css, engine.js, app.js, engine.test.cjs, browser_test.py, README.md, LICENSE）に含まれます。フル版のNode.js単体20/20、Chromium操作28/28合格。Chromiumは管理環境でHTTP遷移をブロックされたため、実HTML・CSS・JSをインライン配置、localStorageは模擬。**このGitHub単体HTML版は別実装のため上記テスト数は適用されず、構文や実ブラウザ操作の同等性は未検証です。**

## 注意
長方形のみ、曲線型紙・柄合わせ・縮み・折り裁ち・縫い代自動加算に非対応。SVGの物理寸法はmm基準ですが、印刷倍率は必ず確認すること。最小用尺の保証なし。

資料: https://prtimes.jp/main/html/rd/p/000005113.000000136.html ; https://ec.europa.eu/eurostat/en/web/products-eurostat-news/w/ddn-20261112-1
