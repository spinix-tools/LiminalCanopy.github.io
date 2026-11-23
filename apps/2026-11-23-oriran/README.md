# 折覧 / ORIRAN 🗞️
2026-11-23 制作。小冊子・ZINE・学校／地域広報向け、原稿作成と中綴じ面付けをひとつの画面で扱うローカルWebアプリ。

## 市場・競合・仮説
- 国内：[ZINE白書2026](https://zinez.org/report/2026)は2026-11-11時点のBOOTH等に掲載されたZINE 3,505点・1,651作者を集計。ただし標本であり日本市場全体の推計ではない。
- 国内競合：[てもとツール 小冊子印刷メーカー](https://temototool.com/tools/booklet-maker/)（PDF中綴じ・右綴じ・自動白紙）、[PodoLay](https://podolay.com/ja/)（日本語組版）。
- 海外需要の手がかり：[Printed MatterのNY Art Book Fair 2026](https://nyabf2026.printedmatterartbookfairs.org/about)（2026年9月24〜27日）は、独立出版者・作家等の**310超の出展者**を主催者が報告。ただしアプリへの有料需要を示す数字ではない。
- 海外競合：[BookletMaker](https://bookletmaker.app/) と [BookletPro](https://bookletpro.app/) はPDF面付け・冊子印刷を提供。
- 差別化仮説：既存PDFの加工だけでなく、ページ原稿を直接編集して、**読順・用紙表裏・追加白紙・印刷チェック**まで同時に扱う。右綴じや端末内処理自体は既存競合も対応。需要・収益性は未検証。

## できること
1〜48原稿ページの追加・削除・編集、左右の綴じ方向、4の倍数の自動白紙（裏表紙手前／末尾）、用紙表裏プレビュー、完成読順、重複・欠落チェック、裏面180°回転、A4横のブラウザ印刷、JSON保存・読込、CSV出力、端末内自動保存。外部API・登録・課金・ユーザーデータ送信なし。

## 起動
GitHub版 `index.html` は完全版のHTML/CSS/JSをgzipでロスレス同梱し、対応ブラウザで自動展開。可読な単独HTMLへ戻すには `python unpack.py`。ZIPには展開済みソースも同梱。

## テスト・制限
- Node.js：**21/21合格**。左右／白紙条件×1〜48ページの全組合せと、800系列のランダム検証を含む。
- Chromium DOM操作：**40/40合格**。管理環境のlocalhostアクセス制限により、同じCSS/JSをインライン実行しlocalStorageのみメモリ模擬。外部通信／JS例外は0件。
- 実ファイル・GitHub Pages URLの起動、実機の印刷・製本、localStorageの実永続化は未検証。複雑な縦組み、画像配置、既存PDFの読み込み、商業印刷用出力は非対応。
- 実機でA4横・両面短辺とじを起点に、必ず最初の1枚を試し刷り。ブラウザの冊子印刷モードは併用しない。

MIT License。
