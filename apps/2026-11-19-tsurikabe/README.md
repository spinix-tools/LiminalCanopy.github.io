# つりかべ / TSURIKABE 🪙

日本円の釣銭不足を、開店前に試算するマルシェ・学園祭・フリマ出店者向けWebアプリ。

**ターゲット:** 個人クリエイター、模擬店、現金販売がある小規模出店者。

**選定理由:** Creemaは2026年4月15日にHandMade In Japan Fes' 2026の延べ3,000人出展予定を告知した（https://prtimes.jp/main/html/rd/p/000000275.000018086.html）。実店舗・催事の会計準備は存在する。ただしアプリ市場の直接の需要推計ではない。

**競合:** 国内[即売レジ](https://apps.apple.com/jp/app/id730021836)はレジと売上・釣銭計算、[出店帳](https://apps.apple.com/jp/app/id6792453816)は収支管理、海外[BoothMinty](https://boothminty.com/)は収支と釣銭準備の目安、[MakeChange](https://www.varo.industries/blog/posts/makechange-cash-change-calculator)は釣銭計算を提供。

**差別化仮説:** 金種別の準備枚数を変え、同一の疑似販売列で不足頻度の変化をシミュレーション。日本円・登録不要・端末内完結。需要検証は未実施。

**実装:** 商品・重み・在庫・現金比率編集、日本円10金種、80日×4案の比較、会計プレビューと簡易レジ、Undo、JSON/CSV、localStorage、レスポンシブUI。外部API・有料サービス不要。釣銭の組み合わせは在庫上限付き探索。

**検証:** ローカル版のNode.js単体テスト44/44、Chromium操作34/34、JS構文検査合格。Chromiumはfile://への直接ナビゲーションを管理環境が拒否したため、同一ソースをインライン展開しlocalStorageを模擬。通常ブラウザでの直接起動、印刷実機、現地検証は未実施。

**限界:** 各会計は1商品。現金支払額は設定に基づく疑似モデルで、金種構成は大きい額面からの仮定。結果は実測確率や販売保証ではない。

**起動:** 同じフォルダーのindex.htmlを開く。MIT License。