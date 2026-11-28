# QRBlockLab / ロゴ配置監査
2026-11-28 MVP。index.html を開くだけ。通信、登録、外部API、入力データの収集なし。

## 対象・選定理由
印刷所、販促・パッケージデザイナー、Web制作会社。国内ではデンソーウェーブが誤り訂正をコードワード単位と説明し、イラスト重畳を非推奨としている。国内向けBlueprintLabのロゴ生成・再読取検査、海外QR Studioの中央ロゴの再読取検査、Dynamsoftの破損シミュレーターが存在する。用途の傍証であり、市場規模・支払意思は未検証。
- https://www.qrcode.com/about/error_correction.html
- https://www.qrcode.com/faq.html
- https://blueprintlab.tech/tools/qr-code-logo-maker/
- https://getqrstudio.app/tools/logo-safe-area
- https://www.dynamsoft.com/codepool/demos/qr-error-correction-visualizer/

## 差別化仮説・操作
Model 2の版1〜6、L/M/Q/H、ロゴ（背景板込み）の矩形、予備訂正語数を入力。内容や画像なしで、機能マス・接触したコードワードをブロック別に数え、同じ寸法で全位置を探索する。優先順位は機能接触数、最大ブロック負荷、元位置との距離、総接触語数、Y、X。未知誤りとして各接触語を1と数え、訂正上限は訂正語数の半分（切捨て）。矩形の外の汚れ等に残す予備を差し引く。JSON保存可能。実際の読み取りを検査する競合の補完であり、独占的新規性は未証明。版5 Hの11×11例は最大負荷6→5、機能接触0→0、面積不変。既存284ディレクトリ名、関連コミット検索、近接READMEを確認（全コード未照合）。

## テスト・限界
Python qrcodeのビット配置・機能マス・ブロック表との24/24一致、独立全位置探索との150/150一致。Chromiumで初期値、探索、JSON実ダウンロード、不正入力、版変更、機能マス接触、390px幅を確認。JS例外・外部HTTP要求0件。file:// が環境ポリシーで遮断されたため同じHTMLをインライン読み込み。test.py（Node.js、Python qrcode、Playwright、Chromiumが必要）。
模式図はQRコードを生成しない。読取成功・規格適合・印刷品質は未検証。余剰ビット、実際の反転有無、誤りの位置が既知の場合、画像認識、マスク、外部余白、版7以降は評価対象外（余剰ビット接触は別集計）。実際のQRを複数端末・印刷条件で試験すること。重要な用途ではロゴ重畳を避ける。
