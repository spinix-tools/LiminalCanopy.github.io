# 寸感 / SUNKAN

**いつもの服を、次の一着のものさしに。** 仕上がり実寸を比べ、購入前の確認ポイントを可視化する無料・オフラインWebアプリ。2026-11-17時点の試作MVP。

## 対象と選定理由

対象：服をネット通販・フリマで買う人、とくにブランド横断でS/M/L表記が役に立ちにくい人。

日本：2026年4月21日の国内300人調査では、アパレルECの購入失敗の最多理由が「サイズ感の違い」48%（調査母集団に限る）。2026年9月30日発表の別調査（250サンプル）では海外アパレル通販のサイズ・イメージ違いも問題となる。市場規模自体より、実寸差を理解するニーズが選定理由。

海外：英国Popsyの2026年調査では、回答者の73%が過去1年でフィット不一致による返品を経験（Popsy顧客・調査対象の条件に注意）。

競合：国内 [unisize](https://service.unisize.makip.co.jp/) はサイズ推薦と手持ち服との寸法比較にも対応。海外 [True Fit](https://www.truefit.com/)、[Sizebay](https://sizebay.com/en/virtual-try-on/) は主にEC向けのレコメンド、[TheAIWardrobe](https://theaiwardrobe.com/fit/size-chart-comparator/) は登録不要の実寸比較にも対応。**手持ち服との比較そのものは新規発明ではない。**

差別化仮説：アカウント・身体寸法・ショップ連携なしで、**平置き実寸4項目 × 複数サイズ × 縦横別の洗濯縮み仮定 × シルエットの希望幅**を、CSV一括登録と端末内バックアップ付きで短時間に比較する。とくに古着や独立店舗のサイズ表を人手で比べるユースケースを想定する。需要・収益性は未検証。

## 動くMVP

1. `index.html` を直接ブラウザで開く（`engine.js` / `app.js` と同じフォルダ）。サーバー不要。
2. 手持ちの服と、購入候補の**仕上がり実寸（身体寸法ではない）**を入力。トップスとボトムスを切替可能。
3. 基準との寸法差、参考点、許容範囲超過を比較。好みの幅と縦横別縮み率を変更できる。
4. 商品名・サイズ・実寸のCSV取込、CSV見本出力、候補CSV出力、JSON保存/復元、印刷、候補削除、端末内自動保存。

**重要:** 数値は平置き仕上がり寸法のみ。身幅やウエスト平置き幅と周長を混在させないこと。洗濯縮み率は任意の仮定で、実測予測や素材別推定ではない。参考点は本ツール独自の加重寸法差であり、着心地や返品回避の確率ではない。素材、伸縮性、型紙、採寸地点、メーカー表示誤差などは扱わない。入力データを外部送信せず、localStorageを使用する。

## テストと制約

- `node --test engine.test.cjs` — **33/33 合格**。スコア、軸別縮み、境界値、CSV引用符、悪意あるCSV式、JSON形式検証など。
- `python browser_test.py` — **46/46 合格**。システムChromium/Playwrightでフォーム操作、編集、ローカル保存模擬、CSV/JSON入出力、削除、XSS安全性、トップス・ボトムス切替、390pxレスポンシブを確認。`file://`直開きナビゲーションが管理環境で遮断されるため、テストは**実HTMLの set_content と実JSスクリプトを読み込み、localStorageをメモリ上で模擬**した。実環境でのオフライン読み込み・永続保存は未検証。
- 実測着用テスト、サンプルユーザー検証、サイト配信、性能保証は未実施。

## 市場調査の参照資料（2026-11-17確認）

- [2026-04-21 セントラルオフィス・国内アパレルEC消費者調査（300名）](https://prtimes.jp/main/html/rd/p/000000030.000072906.html)
- [2026-09-30 NEXER / Return Helper 海外アパレル通販調査・記事](https://ecnomikata.com/ecnews/marketing/51830/)
- [2026 Popsy Fit Fix Report, UK](https://www.popsyclothing.co.uk/blogs/news/popsy-fit-fix-report-2026-online-clothing-sizing-uk)
- [unisize 国内製品](https://service.unisize.makip.co.jp/)
- [True Fit 海外製品](https://www.truefit.com/)
- [Sizebay 海外製品](https://sizebay.com/en/virtual-try-on/)
- [TheAIWardrobe 実寸比較](https://theaiwardrobe.com/fit/size-chart-comparator/)

## 非機能要件

外部API・解析SDK・有料サービスなし。ユーザー登録や氏名・メール等の取得なし。データはブラウザ内のみ（ブラウザによる保存の消去はありうる）。候補データは最大300件、CSV/JSON読込は300KBまで。MITライセンス。
