# MipPhase / アトラス混色監査
2026-11-28 — v1.0

## 対象と選定理由
Unity/Godot等のゲーム開発者、テクニカルアーティスト。日本語Unity公式マニュアルはミップマップとスプライトアトラスを説明。海外には生成・押し出し・間隔チェックのサービスが複数あり、混色対策の需要の間接証拠となる。市場規模・支払意欲は未検証。
- 日本: https://docs.unity3d.com/jp/2019.4/Manual/class-SpriteAtlas.html
- 日本: https://docs.unity3d.com/jp/current/Manual/texture-mipmaps-introduction.html
- 海外: https://ef-tools.vercel.app/tools/texture-atlas-packer
- 海外: https://nerulio.com/en/atlas-padding/
- 近接競合: https://ra.netwrck.com/tools/texture-seam-checker
- 近接競合: https://www.toolsfyi.com/tools/design-tools/sprite-atlas-geometric-padding-clearance-audit

## 差別化仮説
間隔だけでなく、縮小格子との位相・サンプリングフィルターに依存する方向付き混色候補を各Mipで表示。同じ間隔のまま全矩形を右・下へ0〜7px移動し、指定Mipで候補数を最小化する。既存サービスに同等の実装がないことまでは未確認。調査した専用ブランチの差分51アプリ名とatlas/mipmap/sprite/テクスチャのコミット検索では明確な重複なし（全ソース未照合）。

## 使用方法
index.htmlをブラウザで開く。JSONを貼り付けるか読み込み、Mip・Nearest/Bilinearを選び「監査する」。探索・提案適用・JSON出力が可能。独自形式は初期サンプル参照、TexturePacker hash/array形式にも対応。最大100矩形、4096×4096、2のべき乗のみ。入力は端末内処理、外部通信・API・登録なし。

## 検証
`node test.cjs`: 独立タップ列挙1708ケース＋固定10アサーション合格。`python test_browser.py`: Chromium（同一HTMLインライン読込、環境制限でfile://不可）でサンプル、探索、適用、JSONダウンロード内容、不正入力、Bilinear、390px幅、外部HTTP要求・JS例外ゼロを確認。サンプルのMip2 Nearestは候補2→0、右へ2px移動、64候補探索。

## 限界
2×2ボックス縮小、CLAMP_TO_EDGE、半開UV矩形の単一Mipモデル。色・透明度・押し出し・圧縮・異方性・トライリニア・実GPUは未検査。出力は座標計画であって画像の再配置ではない。別Mipの改善は保証しない。候補の件数・交差元画素数は実際の混色量ではない。
