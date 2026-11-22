# サイン感 / SIGNKAN 🏷️

展示ラベルや案内サインを**物理寸法・閲覧距離・色の対比**からレビューする、登録不要のローカルWebアプリ。

## 対象・選定理由・競合（調査日：2026-11-22）

- **対象**: 小規模美術館・博物館、学校展示、地域のイベント・展示制作者。
- **日本の需要兆候**: [浜松市の公共建築物UD指針](https://www.city.hamamatsu.shizuoka.jp/kokyoken/universal/sisin/ud021.html) はサインの書体・設置位置・言語に配慮を求める。[国立西洋美術館](https://www.nmwa.go.jp/jp/experience-learn/public_accessibility.html) には点字・触知図を含むアクセシブルな案内の実践がある。
- **海外の需要兆候**: [米国NPS展示ガイドライン](https://www.nps.gov/features/hfc/guidelines/) は表示距離と文字x高の具体例を掲載。[カナダ人権博物館の展示指針](https://id.humanrights.ca/graphic-standards-for-exhibits/text-hierarchy-and-readability/) も視距離・文字階層を扱う。
- **競合**: [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) は配色の対比比確認ツール。[Digital Polo Sign Letter Height Calculator](https://www.digitalpolo.com/tools/sign-letter-height/) は視距離から文字高を推定。汎用デザインソフトも代替製品。差別化が確立したわけではない。
- **差別化仮説**: 視距離・コントラストの単機能計算ではなく、**複数ラベルの実寸レイアウト→注意箇所→人による現物確認→SVG/CSV・JSON引継ぎ**を端末内で完結できること。市場規模・ユーザー需要・収益性は未検証。

## 起動と機能

同じフォルダの **index.html** をブラウザで開く。外部ライブラリ不要、サーバー不要。

1. ラベルの追加・複製・削除、展示解説・案内・棚ラベルのテンプレート。
2. 見出し・本文・幅・高さ・余白・閲覧距離・文字高さ・色のライブ編集。
3. **mm指定の印刷用SVG** と全ラベル点検CSV、JSON保存/復元、端末内自動保存。
4. 画面色のコントラスト、距離に対する文字x高（近似）、レイアウトのはみ出しを表示。
5. 実寸印刷、照明、視線位置の手動チェックリスト。

## テスト

**完全版（ローカル配布ZIP）**：Node.js単体 **11/11合格**、固定シード1,200ケースを含む。Chromium/Playwright操作 **40/40合格**（編集、テンプレート、SVG/CSV/JSON出力と復元、保存模擬、画面注入非実行化、モバイル等）。JS例外・外部HTTP要求は0件。

**GitHub上のこの index.html** は単一HTMLに再実装した軽量版です。上の11件・40件のテストの対象では**ありません**。GitHub版のブラウザ操作テスト・通常環境の長期保存は未実施です。GitHub版のJS構文チェックは合格、保存した3ファイルの再取得に成功しました。GitHub版のブラウザ操作は未検証です。

管理環境ではローカル/HTTP URL遷移が制限されたため、完全版のChromiumテストは同じHTMLをインライン展開し、ブラウザ保存領域を模擬して行いました。

**重要な限界**: NPS/Parks Canada のHelvetica例をもとに、参照x高を約9.3 mm/mと近似。x高を文字サイズの52%とみなすラテン字形の仮定で、日本語書体の実測値ではありません。WCAG比は画面色の参考値で、印刷物・法令・展示のアクセシビリティ適合認証ではありません。SVGのフォントは埋め込まないため端末・印刷機で組版が変わり得ます。照明・反射・車いす視線・点字/触知図などは現物確認が必要です。

## データ・ライセンス

端末内のlocalStorageと、ユーザーが明示的に保存したファイルだけを使用。外部送信・課金・登録・個人情報入力要求なし。MIT License。

詳細な可読ソース（engine.js, app.js, style.css, index.html）、単独起動版standalone.html、テストと画像はローカル配布ZIPに同梱。