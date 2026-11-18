# ひびしるべ / HIBISHIRUBE

写真にピンで状態を記し、**入居時と退去時**を同じ部屋ごとに並べて点検する、登録不要の日本語WebアプリMVP。

## 対象と選定理由（2026-11-19 調査）
- 対象：日本の賃貸住宅に入居・退去する人、個人家主、小規模管理者。
- 国内需要：国民生活センターの2025年度相談統計では「賃貸アパート・マンション」関連は43,148件（2026年9月16日更新）。原状回復関連では2025年度14,711件（2026年7月31日更新）。後者は前者の部分集合に相当するため**合算しない**。https://www.kokusen.go.jp/soudan_topics/data/annualreport.html https://www.kokusen.go.jp/soudan_topics/data/chintai.html
- 国交省は退去時のトラブル予防に向け原状回復ガイドラインを公開。 https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000020.html
- 国内競合：「入居現況チェック」「入居チェック」は入居時の点検表・写真・PDFなどを提供。 https://apps.apple.com/jp/app/id6799363326 https://apps.apple.com/jp/app/id6808943578
- 海外競合：RentCheckは住民用モバイルアプリとクラウド記録、zInspectorはオフライン検査とレポート、Probataは入退去比較・写真への注釈を提供。 https://help.getrentcheck.com/en/articles/5142298-faq-guide-for-residents https://zinspector.com/features/ https://cleanware.app/probata/
- **差別化仮説**：端末にインストール不要の単純なWebページで、画像上の座標ピン・入退去写真の比較・CSV・注釈付きPNG・写真込みJSONと印刷台帳をオフラインで完結。既存競合にも同様の個別機能があるため、優位性は未検証。着眼は「利用開始と共有前処理の少なさ」。

## 使い方
1. `index.html` をChrome/Edge/Safari/Firefoxなどで開く（同フォルダに `style.css`, `engine.js`, `app.js` が必要）。
2. 時点と部屋を選んで画像を追加し、写真内をクリック。分類・重要度・メモを設定して「ピンを保存」。既存のピンはクリックで編集可能。
3. 右側で同じ部屋の入居時・退去時の写真を比較。台帳はブラウザ印刷からPDF化。CSVやPNG、写真込みJSONを保存できる。
4. 初回は「サンプルを試す」で操作可能。JSONインポートで復元可能。

画像は端末で最大1400pxのJPEGに縮小し、位置情報等のEXIFメタデータを除去したコピーをアプリ内で扱う。ブラウザの `localStorage` に自動保存を試みるが、容量制限やブラウザ設定により保存できない場合がある。**JSONバックアップ必須**。インポート前の記録は置換される。外部送信・追跡・課金・アカウント・API利用なし。

## テスト
- `node --test engine.test.cjs`：**34/34 合格**。入力検証・JSON構造・ピン座標制約・部屋別比較・CSVエスケープ・統計等。
- `python browser_test.py`：**30/30 合格**。Playwright+Chromiumでサンプル生成、ピン追加、編集・削除、CSV/JSON/PNG、実画像インポート、印刷HTML、モバイル描画を確認。管理環境でfile://とHTTP遷移が制限されたため、**同一ソースをインライン配置してページを構築し localStorage を模擬**。端末での直接起動や実際のブラウザ永続保存とは別検証。
- 成否はテストを実施した環境で確認し、実機撮影・複数ブラウザ・印刷機・長期保存は別途検証が必要。

## 限界と注意
これは写真を**編集可能な個人用台帳**にまとめる道具であり、写真がいつ・どこで撮影されたかを検証しない。登録日は撮影日時とは異なる。法的証拠性・損傷原因・修繕費負担を判断できない。元画像・契約書等は別保管する。端末共有時にはブラウザ保存内容に注意する。

MIT License. © 2026.
