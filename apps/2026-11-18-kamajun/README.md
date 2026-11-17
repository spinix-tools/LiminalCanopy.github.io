# 窯じゅん / KAMAJUN（GitHub単一ファイル版）

小さなベーカリー・菓子工房のオーブン焼成順を計画する日本語Webアプリ。**index.html をブラウザで開くだけ**で動きます。API・ログイン・外部通信・課金・個人情報の収集なし。MIT。

## 対象・選定理由・競合
1台の窯で複数の製品を焼く工房。国内では日仏商事の現場紹介で、バゲットの250℃から温度を下げながら菓子を焼く事例がある（https://www.nichifutsu.co.jp/magazine/87905/ ）。国内競合にBakery MiniOn（https://www.bakeryminion.com/ ）、海外にBakeIQ（https://www.bakeiq.ai/features/production-planning ）、WP BakeryControl（https://www.wp-l.de/en/ovens-for-bakeries/digital-product-management/software-wp-bakery-control.html ）、BakeSlot（https://apps.apple.com/jp/app/bakeslot-backplaner/id6809028915 ）がある。2026-11-18調査。

## 差別化仮説
一般的な製造・受注管理より範囲を絞り、天板容量、温度の昇降速度、準備可能時刻、焼成終了希望を即時に比較できる小規模窯専用ツール。既存製品にもオーブン計画機能があるため独占的な新機能とは主張しない。

## 機能
焼成品登録・追加・削除・並び替え／容量に応じた分割／予熱・温度変更・生地待機・納期超過の簡易予測／4モード切替／指示表のCSV／JSON設定出入／端末内保存／印刷。3分割温度段取りなどはユーザー入力の仮定に基づく。最大16品目18バッチ。

## 検証・注意
GitHub版は単独HTMLにまとめた簡易実装で、**専用ブラウザE2Eテストは未実施**。この実行で別途作成した完全版のローカルソースは Node 41/41 と Chromium 43/43 合格（管理環境の制約によりHTML/JS直接配置、localStorageは模擬）。計算は厳密最適化ではなく予測に過ぎない。混載・人員・発酵・冷却・実機温度回復・電力量・衛生管理はモデル外。実配信動作および需要と収益性は未検証。
