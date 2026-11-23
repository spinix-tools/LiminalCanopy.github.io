# 余り板 / AMARITA

端材優先の木取り案をオフラインで作成する日本語Webアプリ。板・部品の実寸 (mm)、刃幅、四辺の逃げ、部品別の木目固定を考慮し、SVG / CSV / JSON で出力します。使用後は再利用できる端材と未使用板を次回用JSONとして書き出せます。

## 対象・選定理由
家庭DIY・学校工作室・木工サークル。経済産業省の2026年4月公表資料によると、2025年の国内ホームセンター DIY用具・素材の販売額は7,679億円（前年比-0.8%）。この数字はアプリの市場規模を表しません。

日本の競合: [Boardcut](https://apps.apple.com/jp/app/id6787905177)（端材保存はPro）、[KiicutterAI Cloud](https://www.kiicutterai.cloud/)。
海外の競合: [Cutlistor](https://www.cutlistor.com/)、[cutlistlab](https://cutlistlab.com/cut-list-optimizer-grain-direction.html)、[CUTLIST.io](https://cutlist.io/)。

## 差別化仮説
小規模DIYや工作教室の「次回の作品へ端材を受け渡す」使い方に絞り、無料・無登録・完全ローカルのJSON引き継ぎで継続利用を促せるか検証する。競合にも端材機能があり、優位性・需要・収益性は未検証。

## 起動方法
`index.html` をモダンブラウザで開く。単一ファイルに完全版ソースを gzip+base64 で格納し、ブラウザ内の `DecompressionStream('gzip')` で展開します。外部ネットワーク通信はありません。Python 3 がある場合は `python unpack.py` で元の可読な `standalone.html` を復元できます。

## 機能
端材・原板の追加/編集、部品数と個別木目ロック、刃幅と四辺の逃げ、近似配置と未配置理由、印刷、SVG（1枚目）、CSV、端末保存/削除、JSON読込/書出し、端材＋未使用板の次回用JSON、元に戻す。

## テスト (2026-11-23)
Node.js 単体 16/16 合格（ランダム500ケースで部品衝突・板外・個数保存など検査）、Playwright Chromium 29/29 合格（同じHTML/CSS/JSをインライン実行、端末保存はメモリ模擬）。外部HTTP要求・実行時JS例外は0。GitHub圧縮版はChromiumで展開し計算画面が表示されるスモークテスト合格。

制限: 直線切断向けguillotine式ヒューリスティックで最適解や実際の切断可能性を保証しません。板材は同一の材種・板厚を想定し、欠陥/機械動作/安全性を判定しません。管理環境がローカルURL遷移を遮断したため、実URLからの起動と永続保存は未検証です。

調査資料: [経産省2025年小売動向 (2026年4月)](https://www.meti.go.jp/statistics/toppage/report/minikeizai/pdf/h2amini174j.pdf)。

ライセンス: MIT。外部API・有料サービス・外部データ収集なし。
