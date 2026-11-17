# ひだまり窓 / HIDAMARI MADO ☀️

**ベランダや窓の向き・庇の寸法から、1日と季節ごとの直射日光の時間を概算する無料・オフラインWebアプリ。**

## 対象・選定理由

- **対象:** ベランダ園芸・室内植物の愛好家、物件内見者、賃貸住宅の居住者。
- **日本の需要シグナル:** 矢野経済研究所は、2023年度の国内ガーデニング・家庭菜園市場を **2,321億円**（メーカー出荷金額ベース）と推定（2024-12-25公表）。購入・趣味市場の存在を示すが、本アプリの有料需要を示すものではない。
- **競合:** 国内では「日照チェッカー」（PLATEAU建物データによる日当たり予測）、Sun Seeker（太陽軌道・AR）。海外では ShadeClock（屋外の陰影と太陽位置）や SunPeek（バルコニーの季節比較）。日照計算自体は新規発明ではない。
- **差別化の仮説:** 地図・カメラ・アカウント不要のブラウザ上で、**庇の奥行き・植物位置から庇までの高さ・正面の遮蔽物の仰角**を直接変え、月別15日の「直射に入る／庇で隠れる」を比較できる単純な道具。競合と実測での優位・需要・収益性は未検証。

参照（確認日 2026-11-17）:

1. 矢野経済研究所（2024-12-25）: https://www.yano.co.jp/press-release/show/press_id/3700
2. 日照チェッカー（App Store掲載）: https://apps.apple.com/jp/app/id6759216345
3. Sun Seeker（App Store掲載）: https://apps.apple.com/jp/app/id330247123
4. ShadeClock（App Store掲載）: https://apps.apple.com/sg/app/shadeclock/id6811853770
5. SunPeek（App Store掲載）: https://apps.apple.com/sg/app/sun-path-sunlight-sunpeek/id6823607987
6. NOAA Solar Position Calculations（数式の参考）: https://www.gml.noaa.gov/grad/solcalc/solareqns.PDF

## 動かし方

`index.html` をブラウザで開くか、このディレクトリで `python -m http.server 8000` を実行し、`http://localhost:8000` を開く。外部依存・ビルド工程・APIキーはありません。

初期例は東京の南向き窓。**東京・札幌・大阪のプリセット**や独自の緯度経度、UTC時差、窓方位、庇奥行き、庇高さ、正面の遮蔽仰角を入力して再計算。直射・庇の影・前面障害物の影を色分けした**24時間タイムライン**、直射時間帯、**各月15日の棒グラフ**、CSV出力、印刷を提供します。設定は `localStorage` のみで端末内保存されます。外部送信・アクセス解析・個人情報収集・追加API課金なし。

## 計算の範囲と限界

NOAAの近似式に従い日付・緯度経度・固定UTC時差から太陽高度・方位を算出。5分刻みのサンプルで「太陽が地平線上」「窓前方±90°」「障害物の仰角より高い」「水平庇の下から見える」を順に判定。庇は**窓面上の観測点から、垂直方向に `clearance` m上、外側に `depth` m伸びた平板**と仮定し、太陽光線とその平板の交差を計算します。年グラフは各月15日の10分刻み評価です。

**天気・地域の地形・正面方位以外の建物・手すり・室内への到達・ガラス透過・植栽・反射光・夏時間の自動補正は非対応。** 遮蔽物の仰角は窓前面の全方位に一律で適用するため、実際の周辺環境を再現しません。「直射可能な時間」であって**実測日照や植物の栽培適性・採光基準の保証ではありません**。5分サンプリングによる境界誤差もあります。

## 検証（2026-11-17）

- `node --test engine.test.cjs`: **15/15合格**（春分の太陽位置、朝夕方位、窓裏側、庇・障害物の遮光、単調性、月別レポート、入力異常など）。
- `python browser_test.py`: **22/22合格**（Chromiumで画面描画、プリセット、日付と方位変更、入力エラー、CSVダウンロード内容、印刷起動、390px画面の横スクロール無し、JavaScript例外無し）。
- **ブラウザ環境の制約:** localhost/file URLへのナビゲーションが管理上ブロックされるため、ChromiumにはHTML/JSを直接挿入し、`localStorage` はモックでテスト。実URLからの配信とブラウザ標準`localStorage`の長期永続性は未検証。`desktop.png`, `mobile.png` は同試験のスクリーンショット。

## ファイル

`index.html` UI / `engine.js` 位置計算 / `app.js` 画面制御 / `engine.test.cjs` Nodeテスト / `browser_test.py` Chromium試験 / `desktop.png`, `mobile.png` プレビュー。

MIT License. © 2026 hourly-app-lab contributors.