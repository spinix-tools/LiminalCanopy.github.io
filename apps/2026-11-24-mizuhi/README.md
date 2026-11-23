# 水比 / MIZUHI

淡水水槽の3水源配合を試算する、外部API・アカウント不要のHTMLアプリ。

## 対象と選定理由（2026-11-24）
シュリンプ・水草水槽など、GH/KHを実測して換水を計画する利用者。国内では日本ペット用品工業会が2026-07-31にアクアリウムフェア2026を案内し、日本語アプリAquaryも換水・水質記録機能を提供。米国ではAPPAの2026 Fish Report公開概要が淡水・海水魚飼育世帯の市場を扱う。購入不要の公開概要のみ確認。これらは市場活動の傍証であり、本アプリの需要・収益性を証明しない。
- 国内: https://www.jppma.or.jp/news/ / https://apps.apple.com/jp/app/id6761718155
- 海外: https://checkout.americanpetproducts.org/products/2026-fish-report
- 競合: https://aquariumhq.app/tools/water-blend-calculator / https://www.theaquariumcalculators.com/calculators/water-change-gh-kh-calculator/ / https://aquariumhq.app/tools/water-change-calculator

## 差別化仮説
2水源の単一目標配合・換水率計算・記録型アプリに対し、3水源の使用上限、GH/KHの同時目標範囲、測定誤差を組み込み、1%刻みで全探索する。範囲内候補の費用を最小化し、範囲外の場合は最大逸脱が最小の候補を明示する。散布図・候補表・全候補CSVで検証できる。日本語検索流入と専門店での紹介を想定。競合の全機能・実利用者への検証は未実施。既存appsディレクトリ一覧と会話中の既出案を確認したが全ソース比較は未実施。

## 使い方とモデル
HTMLをブラウザで開き、実水量、換水率、測定値、上下限、共通測定誤差、3水源の値・単価・使用上限を入力して計算。換水後濃度 = (1-f)×現水槽値 + f×Σ(水源割合×水源値)。各測定の上下限を同様に加重平均（下限は0に丸める）。最大5151候補、費用は入力した同一通貨。端末保存、CSV、印刷対応。初期値は架空の計算例。pH、温度、塩素、反応、生体安全性は判定しない。1%刻みより細かな配合は対象外。実測・専門資料で確認すること。

## テスト
- Node.js: 9/9合格（うち独立実装との乱数100条件照合）。初期例は4686候補中596件が誤差込み目標内、最安38.7通貨単位、配合2.1/3.6/9.3 L。
- Chromium: 初期表示、変更、再計算、保存復元（メモリ模擬）、CSV、無効入力、目標外、上限不足、390px幅を確認。JS例外・外部HTTP要求0件。file:// は管理環境で遮断され、同じHTMLをインライン実行。gzip配布版の展開と初期描画も合格。実際の換水・端末保存の永続性・GitHub URL直接起動は未検証。
- ローカル版: index.html が可読な完全版。node test.cjs、python browser_test.py（PlaywrightとChromium必要）。GitHub版 index.html は同一HTMLのgzip/Base64自己展開版。現行Chromium等で開ける。可読ソース復元: python3 unpack.py（standalone.html を生成）。完全版SHA-256: f44b22119bb2668802f860c41bc1075db57c8bd4b1608aff5f1775644dea635f。
