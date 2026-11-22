# 星点帳 / HOSHITENCHO ✧
2026-11-23 — 星空写真の露出・撮影容量・試写記録を結びつけた静的Webアプリ（MIT / 無料・登録不要）

## 対象と市場調査
星景写真の初心者、天文部、撮影会の参加者が対象。CIPAによる2025年のデジタルカメラ世界出荷は9,438,876台（2026-02-26公表）だが、これは天体撮影者数でも本アプリの需要規模でもない。
- CIPA: https://www.cipa.jp/documents/e/PRESSRELEASE20260226_e.pdf
- 2026年9月実績は2026-11-02公表: https://www.cipa.jp/j/stats/dc.html
- 国内競合: https://tools.potikatsu.com/t/photo-star-shutter/ （500/NPFルールおよび予想星像の伸び）
- 海外競合: https://www.photopills.com/calculators/spotstars （Spot Stars/NPF）、https://exposuretools.net/star-calc （オフラインNPF計算）、https://nrtechstudio.com/tools/star-trail-length-calculator/ （星像軌跡px計算）

## 差別化仮説
単一の推奨露光ではなく、カメラ画素ピッチに基づく予測星像の伸び（px）を撮影者が実写から測った伸び（px）と並べ、その条件での枚数・カード容量・タイムラプス尺まで一画面で点検する。各機能の直接競合は存在し、顧客需要と収益性は未検証。

## 機能
センサー例・焦点距離・赤緯・許容px・露光時間の編集、露光上限・グラフ・14候補比較、撮影間隔と時間から枚数/容量/動画尺計算、試写記録と中央値による実測上限、端末保存、JSON入出力、CSV、印刷、スマホ表示。

## 起動
GitHubの `index.html` は完全版 `standalone.html` をgzipでロスレス内包し、ブラウザ側で展開する単独起動版。現代ブラウザの `DecompressionStream('gzip')` が必要。 `python unpack.py` でHTMLを復元可能。ZIP配布物には編集可能な `engine.js` / `app.js` / `style.css` とテストも収録。

## 検証
Node.js単体テスト21/21、固定シード1,600ケース、Chromium 43/43（完全HTMLおよびgzip起動版で主要操作）、JS例外・外部HTTP要求とも0。実ブラウザのfile://ナビゲーションが管理環境で遮断され、HTML全文をブラウザにインライン展開して検証。通常の直接起動/保存永続性・実写による精度は未検証。

## 計算の制限
恒星日86,164.0905秒と赤緯cos補正の小角近似。画素スケール ≈206.265×画素ピッチµm/焦点距離mm。画面中心での幾何モデルで、大気・収差・視野端・振動等は対象外。「点像」を保証しない。情報をサーバーへ送信せず外部API・有料サービス・秘密情報収集なし。MIT License。
