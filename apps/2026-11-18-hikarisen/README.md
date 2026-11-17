# ひかり線 / HIKARISEN — LED配線プランナー

2026-11-18製作。対象：電子工作の初学者、学校のSTEM教材、小型LED造形。**このGitHubフォルダは単独HTMLで動く軽量MVP**。ブラウザで `index.html` を開く。追加API・有料サービス・個人情報収集・外部ライブラリなし。

## 選定と競合
日本：2025年の子供向け情報教育市場は352億円という周辺指標（GMO・船井総研、2025年公表）。電子回路需要そのものではない。
国内 [OneCalc](https://onecalc.app/ja/led-resistor/) と [BlueGrays](https://bluegrays.com/ja/tools) はLED抵抗・電池の計算を提供。海外 [Tools in a Tab](https://toolsinatab.com/en/tools/led-resistor-calculator/) と [AZRS](https://www.azrscorp.com/quickfix/simulations/led-circuit-designer/) は標準抵抗・並列回路等に既に対応。
**仮説**：複数色の独立したLED系統ごとに、抵抗・発熱・安全余裕・部品点数・電池時間を日本語の一画面で提示すると、工作準備の手間を減らせる。独創性と収益性は未検証。

## GitHub版の機能
系統追加/削除、LEDの色・順電圧/直列数/並列数/希望電流、E12/E24推奨抵抗、抵抗の消費電力、電流警告、電池時間、CSV部品表/設定JSONの出力・読み込み、ブラウザ内保存。24V以下の直流向け。
**完全版との違い**：このリポジトリ版は軽量な単一HTML実装。別途配布したZIPには、詳細なワースト電流計算、個別の部品メモと配線概念図などを備えた複数ファイル版とテストが入っています。ZIP版のテスト結果をこのHTMLに転用しません。

## テストと制限
ZIP完全版：Node.jsの単体テスト26/26、Chromium模擬ブラウザ操作22/22合格。GitHub単一HTML版については静的コードチェックのみで、Chromium E2Eは未実施。
実回路・実電池・公開配信では未検証。電池持続時間は単純な電流比例モデル。LED Vfと電流定格は実データシートで確認し、配線後は計測してください。電源の温度・電圧降下などはモデル化しません。商用電源や高電圧に使用しないでください。

ソース配布: MIT License。 `main` ブランチは変更しません。
