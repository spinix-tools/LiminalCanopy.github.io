# 公開マスク / KOKAI MASK (GitHub単一HTML版)

写真の**見える情報（人物・名札・住所など）を手動で不透明に黒塗り**し、**埋め込みメタデータを再エンコードで除去し再検査**してから共有用PNGを作るWebアプリ。`index.html`を開くだけ。登録・サーバー・APIキー・追加課金は不要。ファイルは外部送信しない。

## 対象 / 選定理由

学校、地域イベント、個人SNSの写真投稿者向け。2026年7月の東京都「こたエール」相談事例はExifの位置情報のみならず服装・背景から居場所を推測できるリスクを指摘。警視庁も写真風景からの特定に注意喚起している。

## 競合（2026-11-23調査）

- 国内：Image ToolkitのEXIFクリーナー https://imagetoolkit.org/ja/extiftool
- 海外：ExifCleaner（デスクトップ、マルチ形式） https://github.com/szTheory/exifcleaner
- 海外：ExifCleaner.org（ブラウザ処理、メタデータ除去） https://exifcleaner.org/
- 海外：exifree（ロスレス除去、再検査） https://github.com/arnon-shub/exifree

差別化仮説は**黒塗り・目視チェックリスト・PNG再エンコード・再検査・点検JSON**を一続きにすること。独自市場規模や収益性は未検証。

## 機能

JPEG/PNG取込み（20MB・2,500万画素以内）、EXIF等のコンテナ検出、画像上の手動矩形黒塗り、Undo/全消去、3項目の目視確認、静止画をPNGで書き出し、再検査（対象付加情報が残れば保存不可）、中立ファイル名、JSON点検記録、ダミーExif付きサンプル。

このHTMLは単一ファイルで動作する軽量版。別途検証した**分割ソース版**はこの実行のZIP成果物に含む。

## テスト

- 分割ソース版：Node.js単体10/10、Chromium操作24/24合格。出力ピクセルが黒、PNGのEXIFが空、通信0件を確認。
- GitHub単一HTML版：**ブラウザ操作は別途確認の必要あり**（本READMEの数値は分割ソース版のもの）。
- 管理環境でfile://遷移が制限されたため、ブラウザテストは同一のHTML/CSS/JSをインライン実行。実利用精度・長期運用・スマホ実機は未検証。

## 制限

GPSタグ内の座標値は解析せずEXIFコンテナの有無を示すのみ。画像中の個人情報や顔を自動認識しない。すべてのメタデータ・識別リスクの排除は保証しない。HEIC、アニメーション、WebP、動画、C2PA真正性の保持に非対応。PNGへの変換で色や容量が変わり得る。

参照：東京都（2026年7月）https://www.tokyohelpdesk.metro.tokyo.lg.jp/consult/jirei/personaldata.html ／ 警視庁 https://www.keishicho.metro.tokyo.lg.jp/kurashi/cyber/notes/personal_info.html

MIT License.