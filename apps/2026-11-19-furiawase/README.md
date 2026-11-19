# ふりあわせ / FURI-AWASE

決済・ECの精算CSVと銀行入金CSVを**ブラウザ内だけで**照合する、無料・登録不要の静的Webアプリ（MVP）。

## 対象・選定理由（2026-11-19調査）

日本の小規模ネットショップ、ハンドメイド販売者、経理担当者。経済産業省が2026-10-21に公表した調査によれば、2025年の国内BtoC-EC市場規模は27.6兆円（前年比5.5％増）。また、freeeはBASE・楽天ペイの売上自動取り込みを案内する一方、Yahoo!ショッピングの同期終了について手動登録・インポートを案内しており、CSVを使った確認作業のニーズが想定される。**市場規模はこのアプリの需要を直接示すものではなく、需要・ヒット可能性は未検証。**

## 競合・差別化仮説

- 日本: **freee会計**はBASEや楽天ペイの取引連携などを提供。会計システムと金融サービスの自動連携は本MVPより高機能。
- 海外: **Stripe**は正式な Payout reconciliation report を提供。**Reconciler / PayoutWatch** は銀行との照合や差額説明を提供。**Vexyn / Reconcile Locally** には端末内CSV処理・照合があり、ローカル実行自体は独自発明ではない。
- 仮説: **日本語CSVの列対応 + 手数料・返金込みの金額再計算 + 誤確定を避ける1対1の候補限定 + 手動確定と差額の監査CSV**を、単一の無料・軽量画面で提供すれば、規模の小さい出店者の「確認だけしたい」用途で選ばれる。競合に対する実証的優位性は未検証。

## 実装済みの機能

1. 日本語／英語ヘッダーの自動認識・手動列マッピング、UTF-8 / Shift_JIS CSV読み込み（ファイル各2MB・5,000行まで）。
2. 売上 − 手数料 − 返金 ＋ 調整額 とCSV記載純額の検算（**円単位の整数のみ**）。精算日の後、指定日数以内の入金を候補とし、許容金額差を指定可能。
3. 相互に唯一の1対1候補だけを自動確定。重複候補・金額近似・不一致・計算不一致・未対応銀行明細を別表示。手動割当・解除で再計算。
4. 検索・状態別絞り込み、判定CSVエクスポート（表計算ソフトの数式注入を軽減）、サンプルCSV・ひな形出力、印刷。
5. `fetch`、外部ライブラリ、Cookie、localStorage、アカウント認証を使用せず、データをブラウザメモリ内でのみ処理。タブを閉じる／初期化すると読込データは消える。

## 起動・操作

同じフォルダの `index.html`, `style.css`, `engine.js`, `app.js` を配置し、`index.html` を一般的なデスクトップブラウザで開く。最初は「サンプルで試す」で機能確認可能。実CSVでは左右のファイルを読み込み、必要ならプルダウンで列を指定。金額差のある明細は自動確定せず、原本と突き合わせて手動確認する。ユーザー自身の銀行口座や決済サービスへの接続はしない。

## 検証結果（ローカル実行）

- `node --test engine.test.cjs` : **19/19 件合格**。CSV/BOM/改行/引用符、金額・日付、手数料・返金、候補重複、手動割当、許容差、CSV注入対策ほか。
- `python browser_test.py` : **Chromium 34/34 アサーション合格**。デモ、要確認、曖昧性、手動照合と解除、CSVダウンロード、列手動マッピング、初期化、モバイル幅を確認。テストには Playwright と Chromium が必要。
- `node --check engine.js && node --check app.js` : 構文検査合格。
- **制限**: 管理環境では `file://` 直アクセスがポリシーにより拒否されたため、同じHTML/CSS/JSをインライン展開してChromium試験を実行。通常のローカルファイル直接起動、銀行実データ、実際の入金記録との正確性、印刷実機、ブラウザ間動作は未検証。

## 設計境界・注意

決済サービス独自の手数料、返金の符号、留保金、翌月繰越、相殺、複数精算を合算した入金、外貨換算、分割入金、会計仕訳、税額計算、銀行明細の出金列は自動処理しない。推定で勝手に合致を確定せず、公式精算明細を優先する。手動照合は確認済みという**操作履歴上の状態**であり、取引の真正性の証明ではない。読み込みエラーのある行は照合対象外になるため、エラー数を確認する。

## 参照（2026-11-19閲覧）

- 経産省 2026-10-21公表の調査（掲載を確認）: https://www.meti.go.jp/press/2026/10/20261021001.html （環境によって403。内容は https://netshop.impress.co.jp/e/2026/10/27/16926 にて確認）
- freee BASE連携: https://support.freee.co.jp/hc/ja/articles/203274964-BASE-%E3%83%99%E3%82%A4%E3%82%B9-%E5%A3%B2%E4%B8%8A%E3%83%87%E3%83%BC%E3%82%BF%E3%82%92%E5%8F%96%E3%82%8A%E8%BE%BC%E3%82%80
- freee Yahoo!ショッピング 同期終了: https://support.freee.co.jp/hc/ja/articles/204972080-Yahoo-%E3%82%B7%E3%83%A7%E3%83%83%E3%83%94%E3%83%B3%E3%82%B0-%E5%A3%B2%E4%B8%8A%E3%83%87%E3%83%BC%E3%82%BF%E3%82%92%E5%8F%96%E3%82%8A%E8%BE%BC%E3%82%80
- Stripe Payout reports: https://support.stripe.com/questions/payout-reporting-options
- Reconciler: https://reconciler.co/ecommerce-payment-reconciliation-software
- PayoutWatch: https://apps.shopify.com/payoutwatch-1
- Vexyn: https://vexyn.app/
- Reconcile Locally: https://usereconly.com/

MIT License. Source files are self-contained and do not require an API key or paid service.