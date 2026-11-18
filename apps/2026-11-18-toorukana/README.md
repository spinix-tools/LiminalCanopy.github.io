# とおるかな / TOORUKANA

> 家具を運ぶ前に、L字の廊下を回転して通過できる **2D経路候補** を探す、登録不要・オフライン対応のWeb MVP。

## 対象・選定理由

- **対象**：引っ越しを予定する日本の生活者、大型家具・家電の販売員、配送手配担当者。
- **日本の需要の傍証**：総務省統計局が2026年2月3日に公表した2025年の市区町村間移動者数は約519万人（※アプリ需要の直接推定ではない）。無印良品は2025年3月7日付の案内で搬入経路の事前確認と「梱包サイズ」の重要性を説明。ニトリも家具が通らない場合があるためルートの幅・高さを確認するよう案内。
- **海外競合**：MoveClear（ドア・直線廊下・90°コーナーの判定と2D/3D表示）、RoomFitter（部屋レイアウト、ドア・角のチェック）、PhotoMeasureKit Furniture Fit Checker（経路上の複数チェックポイント）。国内競合には無印良品の「搬入スペースシミュレーター」がある。
- **差別化仮説**：cm前提の日本語UIで、**L字角に絞った探索経路を段階再生でき、手動で動かして壁との衝突を即時判定できる**。印刷可能なSVGと現地確認用CSVも提供し、登録・サーバー通信を不要にする。類似機能は競合にもあるため独自性はUXの組合せに限定する。

## できること

- 家具の梱包時寸法・廊下2方向の幅・長さ・余裕幅・天井高の編集。3プリセット。
- 2Dの長方形家具の移動・15°回転を離散状態探索（BFS）し、衝突しない経路の**候補**を検出。各動作の途中5点も衝突判定。
- 候補の再生、スライダー、手動移動・回転、壁接触の警告。
- SVG図面、経路CSV、設定JSONの出力、JSON復元。設定は localStorage に保存。

## 起動・テスト

`index.html` をブラウザで開くだけ。依存ライブラリ・API・アカウントは不要。

- `node --test engine.test.cjs`：**24/24 合格**（2026-11-18）。
- `python browser_test.py`：**30/30 合格**（Chromium 1440px / 390px、2026-11-18）。Playwright と Chromium が別途必要。管理環境の `file:` ナビゲーション禁止を回避するため、**同一HTML・CSS・JSをインライン配置して試験**。設定の localStorage 保存持続性、実配信サーバー、現物搬入は未検証。

## 重要な制約

**搬入可能判定・搬入不可判定ではありません。** 2Dの立てた状態の矩形外形だけを扱い、立体的な傾斜、昇降・段差、壁厚、出入口の扉、取手、照明、巾木、手すり、人の手の厚み・荷重、現場の公差は未考慮。「経路なし」も探索刻みと上限による未検出の可能性があります。経路ありでも搬入保証ではありません。**梱包寸法と現場を測り、業者に相談**してください。個人情報の収集や外部への通信は行いません。

## 参考・競合URL（確認: 2026-11-18）

- 総務省統計局「住民基本台帳人口移動報告 2025年」(2026-02-03): https://www.stat.go.jp/data/idou/2025np/jissu/youyaku/index.htm
- 無印良品「大型家具を買うのですが、搬入できるかわかりません」（2025-03-07）: https://www.muji.com/jp/ja/store/articles/staff-blog/newlife/1577315
- 無印良品「大型家具・家電製品の搬入」: https://faq.muji.com/%E5%A4%A7%E5%9E%8B%E5%AE%B6%E5%85%B7%E3%83%BB%E5%AE%B6%E9%9B%BB%E8%A3%BD%E5%93%81%E3%81%AE%E6%90%AC%E5%85%A5-656d4e421c58e70026d3c3c5
- ニトリ「お届けについて」: https://www.nitori-net.jp/ec/userguide/delivery/
- MoveClear: https://apps.apple.com/il/app/moveclear/id6799502311
- RoomFitter: https://roomfitter.app/
- PhotoMeasureKit: https://photomeasurekit.com/tools/furniture-fit-checker/index.html

MIT License. Copyright (c) 2026 spinix-tools contributors.
