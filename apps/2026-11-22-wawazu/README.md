# 輪話図 / WAWAZU

2026-11-22。学校・対話型ワークショップ向け、繰り返し班替えの「会話接点」を可視化するオフラインWebアプリ。

## 起動
`index.html` をダウンロードし、ブラウザで直接開く。API・ログイン・有料サービス・外部送信なし。匿名の英数字コードのみ対応する。

## 実装機能
4〜48人の参加コード、欠席者、2〜12班、シード付きシャッフル探索、過去の同班ペア重複を減らす複数案、プレビューと確定済み履歴の分離、Undo、接点カバー率・再会ペア数、CSV/JSON書き出し、JSON読み込み、端末保存・復元、印刷。

## ターゲットと選定理由
学校の授業、地域の勉強会、ワークショップのファシリテーター。日本では文部科学省が「協働的な学び」を重視している。現場で前回の組合せが偏ることを防ぎたいという仮説から選定。ただし需要規模や事業性は未確認。

## 競合と差別化仮説（2026-11-22調査）
国内はiOS「グループわけ」（重複回避・履歴機能）、海外はGroupMixer（多回グループ分け・条件指定）とRedmoon No-Repeat Group Mixer（履歴を使った再編成）がある。競争は強い。輪話図は「同じ班に入った**接点の到達率**と偏り」を視覚化し、仮案と実施済みの記録を分け、匿名コードに限定する小さなツールに特化する。接点は会話実績ではなく**同班の代理指標**。最適性の保証や禁止ペアの制御はない。

## 検証
完全版（本実行で生成したZIP内）についてNode.js **20/20テストブロック成功**（ランダム160ケース含む）、Playwright/Chromium **24/24項目成功**。Chromiumでは環境制約でHTMLをインライン表示し、localStorageを模擬。GitHubに保存する本ファイル `index.html` は、同じ機能範囲を実装した軽量単独HTML版であり、**上記テスト数はGitHub版に対する結果ではない**。GitHub版の直接ブラウザ操作は未検証。通常のファイル起動と永続化も未検証。

## 出典
- 文部科学省「協働的な学び」 https://www.mext.go.jp/a_menu/shotou/new-cs/senseiouen/mext_01492.html
- 文部科学省 2026-07-03探究の時間WG https://www.mext.go.jp/b_menu/shingi/chukyo/chukyo3/115/siryo/mext_00023.html
- 国内iOS「グループわけ」 https://apps.apple.com/jp/app/id1396507973
- GroupMixer https://groupmixer.app/multi-round-group-generator
- Redmoon https://redmoonrandomizers.com/tools/group-mixer

## ライセンス
MIT License。
