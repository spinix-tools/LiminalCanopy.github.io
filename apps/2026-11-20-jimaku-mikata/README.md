# 字幕みかた / JIMAKU MIKATA

日本語字幕の**文字数・読み速度・改行・字幕間隔**をSRT/VTTから調べ、元の本文を削らずに修正案と差分を比較する、登録不要の静的Webアプリです（2026-11-20制作）。

## 対象・市場調査
対象：個人映像制作者、学校・自治体広報、字幕制作の初学者。
- 日本：NTTドコモ モバイル社会研究所の2026年5月28日公表調査ではオンライン動画サービス利用率83%。総務省は2026年10月30日に2025年度の字幕放送実績を公表。両者は字幕編集ツールへの支払意思を直接示す指標ではない。
- 海外：AP-NORCの2025年9月27日発表では、米国成人のおよそ3人に1人が字幕を常時または頻繁に利用。英国Ofcomの2025年分報告でも字幕供給が重視されている。
- 日本語の「1秒4文字」慣行は絶対的基準でない。豊倉・山田（2017）の実験報告の抄録には6字/秒でも鑑賞者に受容されたとある。4/6/8字のプリセットはいずれも編集用仮設定。

## 競合と差別化仮説
- 国内 [NekoMoji](https://nekomoji.app/)：自動文字起こし、AI校正/品質チェック。
- 海外 [Subtidy](https://subtidy.io/)：ローカル字幕QC、自動改行・伸長・縦画面プレビュー。[SubtitleWave](https://subtitlewave.app/srt-editor)：字幕・動画・波形編集。
- **仮説**：日本語の4字/秒・6字/秒による結果差、手動固定済みキューを維持する修正案、原文不変、制約で未解決の問題を明示するという一連の作業が小規模制作者に有用。競合機能との重複は大きく、独自性・需要・収益性は未検証。

## 機能
SRT/VTT読込・貼り付け、日本語文字数/行数/秒数・間隔/重複の診断、プリセット/閾値編集、一覧の絞込み、本文/時刻/ロックの手編集、原文を変えない自動改行・可能な範囲の終了時刻延長、A/B指摘数比較、Undo、16:9/9:16の模擬表示、SRT/VTT/検査CSV/プロジェクトJSON出力、JSON復元、localStorage自動保存。
標準 HTML/CSS/JSのみ・ビルド不要。端末内処理、外部API/課金/個人情報収集なし。
自動修正は開始時刻を動かさず、字数を削らず、後続との間隔を確保できない場合は解決しない。実際の音声同期・意味ある改行・読みやすさは人手確認を要する。高度なWebVTTメタデータは完全往復しない。

## 検証（この実行のローカル版）
- `node --test engine.test.cjs`：**32/32合格**、擬似乱数500条件で開始時刻/文字の保存・固定・非重複を確認。
- `python browser_test.py`：**19主要画面操作のシナリオに合格**、ChromiumのJS例外なし、スマホ幅の横スクロールなし。
- `python browser_extra_test.py`：SRTファイル読込、SRT/JSONダウンロード、JSONプロジェクト復元の追加シナリオ合格。
- `node --check engine.js` と `node --check app.js`：合格。
- 環境制約によりfile://へのChromium直接遷移が拒否され、同一のHTML/CSS/JSをインライン展開して画面検証。端末保存の持続性、実ファイルダウンロード、実利用者の視認性・音声同期は未検証。
- 使い方：`index.html`を通常ブラウザで開く。

## 資料（2026年11月20日閲覧）
1. NTTドコモ（2026-05-28）https://www.moba-ken.jp/project/service/20260528.html
2. 総務省（2026-10-30発表の二次資料）https://praze.jp/news/gov-1c57b74a76ec011c8d6cdf9730f824a5/
3. AP-NORC（2025-09-27）https://apnorc.org/projects/closed-captioning-on-its-a-generational-thing/
4. Ofcom（2025年分報告）https://www.ofcom.org.uk/tv-radio-and-on-demand/accessibility/television-and-on-demand-programme-services-access-services-report-january-to-december-2025
5. 豊倉・山田（2017抄録）https://cir.nii.ac.jp/crid/1390586189771111680
6. NekoMoji / Subtidy / SubtitleWave 上記各公式サイト

MIT License.
