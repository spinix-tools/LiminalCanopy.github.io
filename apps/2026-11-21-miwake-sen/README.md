# 見分け線 / MIWAKE SEN
2026-11-21作成。色に頼らず区別できるデータグラフの日本語・ローカルWebアプリMVP。

## ターゲットと選定理由
- 学校教員、NPO、自治体・企業の小規模広報、データ制作チーム。
- グラフの読みにくさを下げる需要を想定。日本のデジタル庁デザインシステムでもコントラストや色以外の伝達手段が扱われ、国内向け作業補助のニーズが考えられる。市場規模、売上、継続利用は未検証。

## 日本／海外競合
- 国内の文脈：デジタル庁のアクセシビリティ指針、Adobe Colorの日本語「色覚シミュレーターとセーフパレットツール」。
- 海外：Datawrapper（色覚チェック・データ表・アクセシビリティ対応）、Adobe Color、Adobe Leonardo（色差と配色スケール）。
- **差別化仮説**：日本語CSVをコピーしてすぐ、線種・マーカー／棒の模様・近似色覚チェック・CSV/SVG出力まで、登録不要・外部送信なしで一画面完結できる。

## このGitHub版の機能
index.htmlのみを開いて利用する。サンプルCSV、引用符対応CSVパーサ、折れ線/集合棒、系列色の編集、P/D/T型近似・白黒プレビュー、色差(CIE Lab ΔE76)・白背景比の参考点検、数値表、SVG/CSV/設定JSON書出し、localStorage保存を実装した。追加API・有料サービス・個人情報収集なし。

**ご注意：GitHubは自己完結型の軽量版です。** 今回の検証済みZIP版は別にあり、CSVファイル読込・設定JSON復元・軸編集などの操作とテストをより詳細に含む。ZIP版の単体・ブラウザテスト結果を、こちらの軽量版のテスト結果として扱わない。

## 検証
- GitHub軽量版：GitHub書込み成功、再取得し19,000文字弱の本文を確認、JavaScript構文検査に成功。実ブラウザでの動作試験は未実施。
- **別途提供するZIP完全版**：Node.js純関数 **36/36合格**（固定シード400条件を含む）、ChromiumによるUI **44/44合格**、例外0、外部通信0、SVG XMLパース・CSV/JSON入出力を含む。
- UI検査環境ではfile://とlocalhostがブロックされたため、ZIPと同一のCSS/JSをインライン展開して検査し、保存先localStorageはモック。実環境での永続保存・色覚視認性・紙面印刷精度は未検証。
- 色覚シミュレーションは参考近似であり、病態再現やJIS/WCAG適合を保証しない。ΔE76が18未満、背景比が3:1未満の条件は本アプリ独自の注意ルール。

## 競合・市場の参考（2026-11-21アクセス）
- デジタル庁：https://design.digital.go.jp/dads/foundations/color/accessibility/
- JIS/WCAG「色の使用」（JR東日本チェック例）：https://www.jreast.co.jp/id/web_accessibility/2025/03/25/1.4.1.html
- Adobe Color日本語：https://color.adobe.com/jp/create/color-accessibility
- Datawrapper：https://www.datawrapper.de/docs/how-we-make-sure-our-charts-maps-and-tables-are-accessible
- Datawrapper色覚チェック：https://www.datawrapper.de/academy/automatic-colorblind-check
- Adobe Leonardo：https://leonardocolor.io/

## 次の検証
教員・広報担当5〜10名で、競合ツールと比較した作業時間、色による識別ミス、SVGの再利用率を測る。
