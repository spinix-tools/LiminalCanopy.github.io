# ひかり番 / HIKARI BAN

2026-11-21（JST）制作。**展示資料の積算照射量（lux·h）を複数作品ごとに比較し、照度または展示終了日の調整案を作る日本語Webアプリ**。対象は小規模博物館・地域資料館・ギャラリーの展示担当者。

## 市場・選定・競合
日本：文化庁の博物館総合サイトは国内5,700以上の博物館を説明する（https://museum.bunka.go.jp/museum/）。日本博物館協会が**2026年3月30日**に公表した2024年度の総合調査速報は、4,368施設を対象として2,507施設から回答（https://current.ndl.go.jp/car/276977 で**2026年4月7日**に紹介）。これは対象組織の活動規模に関する間接指標であり、当アプリへの需要や有料利用意向を証明しない。

保存管理の背景：パナソニックの美術館・博物館向け照明解説（https://www2.panasonic.biz/jp/lighting/plam/manual/plan/museum/）。海外の競合にはNational Gallery / Lux Allowance Calculator（https://jpadfield.github.io/Lux-Allowance-Calculator/about.html）、ArtRatio Dashboard（https://www.artratio.co.uk/dashboard）、CCI Light Damage Calculator（https://herie.pl/Home/ManualLightDamageCalculator2）、USCalc（https://uscalculators.com/conservation/lux-hour-light-fading-calculator/）などがあり、光量計算・材料リスク・回転計画は新規の機能ではない。

**差別化仮説：** 複数資料を一画面で並べ、開館曜日・閉館時の微小照度・既使用量・資料ごとの予算を合わせて超過箇所だけを表示し、照度と終了日の両方から計画を直せる軽量・日本語・登録不要のワークフロー。類似競合に対する優位性・収益性は未検証。

## 動かし方・機能
**GitHub版は単一HTMLの軽量MVP**。 `index.html` をブラウザで開く。複数資料の追加/編集/削除、開館曜日変更、lux·h の日別計算・予算超過判定、照度上限/終了日調整候補と適用、CSV/JSONの書出し・JSON復元、端末内保存、印刷。初期値は架空の資料・任意の予算。

**検証:** 同時配布の**マルチファイル完全版ZIP**に対し Node.js 単体テスト31/31、300ケースの算術条件検証、Chromium DOM操作34/34合格、JS構文チェック合格。管理環境が外部URLと `file://` への直接遷移を禁止するため、同一ソースのHTML/CSS/JSをインライン展開して検証。端末保存はモック。**GitHubの軽量HTML版には上記テスト結果を流用しない**（保存・内容検証のみ）。ZIPは完全版と全テスト・画面画像を含む。

**重要な限界:** これは数学的な展示計画補助であり、材質別の安全予算や退色、光源のスペクトル、UV、時間による実測照度変動を推定しない。予算は担当者が専門資料から設定し、実測と保存担当者の確認を要する。閉館日の微小照射量も積算する。0luxの提案等は閲覧性を保証しない。損傷防止の認証は行わない。

外部API・CDN・アカウント・課金・解析・個人情報収集なし。ブラウザ内のlocalStorageのみ。MIT License。**mainは変更しない**。
