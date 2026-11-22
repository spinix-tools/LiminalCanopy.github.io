# 差替え灯 / SASHIKAE LAMP

仕入れ元・規格書・登録アレルゲンの変更が共通仕込み品を介してどのメニューへ波及するかを確認する、ローカル処理のWebアプリ。対象は小規模飲食店・ベーカリー・惣菜店。2026-11-22制作。

## 選定理由と競合
消費者庁は2026-04-01にカシューナッツを特定原材料に追加、ピスタチオを表示推奨対象に追加した。2026-09-30には外食・中食の情報提供実態調査を告知した。英国Food Standards Agencyも2025-02-24に非包装食品のアレルゲン情報更新を重視するガイダンスを公開。国内ではCAN EATとBookmi、海外ではNutriticsとApicbaseがアレルゲン・レシピ情報の管理を提供している。

## 差別化仮説
重厚なレシピ・栄養管理ではなく、**変更前の試算／共通仕込み品を介した依存経路／未照合の明示／影響メニューのCSV**に特化し、登録不要・API不要で利用できること。競合に機能上の重複があるため需要・収益性は未検証。

## 機能
仕入先・版番号・登録タグの変更案、影響経路の表示、材料・レシピ追加、循環参照防止、台帳反映・Undo、JSON入出力、CSV出力、端末内保存。日本の2026年4月の9+20品目を登録タグとして扱うが自動判定はしない。

## 検証
**完全版ソース（別途ZIP配布）**に対して Node.js 23/23合格、500件の固定シードDAG検証、Chromium操作29/29合格、JavaScript例外0件、外部通信0件。ブラウザ管理環境の制約で分割ファイルをインライン展開、localStorageを模擬。現場実証は未実施。GitHub版が完全版と別実装の場合、その操作試験は個別に実施していない。

## 重要
アレルゲンの不含有、食品の安全性、法令適合、交差接触の不存在は保証しない。現物・仕入先規格書・食品表示の担当者確認が必須。初期デモは架空。個人情報収集・外部API・有料サービスなし。

## 参考URL
- https://www.caa.go.jp/policies/policy/food_labeling/food_sanitation/allergy/
- https://www.city.kobe.lg.jp/a99427/kenko/health/hygiene/food/syokuhineisei/insyokuten.html
- https://about.caneat.jp/news/20230620/
- https://bookmi.ai/tools/allergen-hyo
- https://www.nutritics.com/en/support-center/find-and-replace-ingredients/
- https://get.apicbase.com/allergen-management-software/
- https://www.gov.uk/government/publications/allergen-information-for-non-prepacked-foods-best-practice/allergen-information-for-non-prepacked-foods-best-practice

MIT License.
