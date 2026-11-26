# 裏順 / RefeedMap

手動両面印刷の3枚の試し刷りから、裏面ページ順を判定するローカルWebアプリ。index.html をブラウザで開く。依存ライブラリ・API・通信なし。

## 対象と市場（2026-11-26）
家庭・小規模教室・ZINE制作者など、手動で用紙を再給紙する利用者。国内のメーカー説明書では、束の扱い・とじ方向・用紙対応が機種や設定に依存する。海外にも複数の両面印刷テストサービスがあり、位置・向きの確認という需要の存在を示す。ただし市場規模・支払意思は未検証。
- Epson: https://download4.epson.biz/sec_pubs/ew-m5610ft_series/useg/ja/GUID-77EF2BA9-6008-430E-B320-A88BFCEABD47.htm
- Canon: https://ij.manual.canon/ij/webmanual/Manual/All/TS6230%20series/JP/NTR/ntr_t_03_08.html
- Konica Minolta: https://www.konicaminolta.jp/business/support/printers/faq/pagepro1400w_005.html
- PrintTest.org: https://printtest.org/duplex-printer-test-page/
- PrintableTestPage: https://printabletestpage.com/duplex-test-page/
- PrintTestPageOnline: https://www.printtestpageonline.com/duplex-printer-test-page/

## 差別化仮説
競合の2面テストに対し、3枚の表裏対応を観察し、正順/逆順を判定して本番の偶数ページ順に変換する。機種別データベース不要。重複・不規則な順序・上下逆・同じ面への印刷では計画を発行しない。奇数原稿は末尾白紙の追加を明示。JSONで設定を記録する。

## 操作
1. 対応する普通紙3枚に表A/B/C、機種説明書に従い再給紙し裏1/2/3を別々に印刷。両方とも片面、部数1、1ページ/枚、逆順なし。
2. 指定の辺で各紙をめくり、反対面の番号と向きを入力。架空例は実機観察ではない。
3. 2〜500ページの原稿に対する表/裏順を確認し、必要なら末尾白紙を追加。印刷ソフトの実際の出力順と白紙省略設定に注意。本番前に少量で再確認。

## テスト
- `node test.cjs`: 固定の不正入力・順序判定および2〜500ページ×正逆順の998ケース合格。
- `python browser-test.py`: Chromium + PlaywrightでUI、JSON実ダウンロード、無効化、390px幅、印刷DOM、JS例外・HTTP要求ゼロを確認。環境のfile://制限のためHTMLインライン読み込み。実印刷ダイアログは起動せず、印刷DOMのみ検証。
- 未検証: 実機印刷、ドライバー差、3枚超での特殊な排紙順、紙質、他ブラウザ、市場規模・収益性。PDF原稿の加工・プリンター制御は行わない。単純な正逆順以外は対象外。
