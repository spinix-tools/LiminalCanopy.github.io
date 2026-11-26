# MipFence / 縮小にじみ検査

2026-11-26 | ゲーム開発者・2D素材制作者向け。index.html をブラウザで開く（外部依存なし）。サンプル、または PNG/JPEG/WebP（10 MiB、各辺1024px以下）を読み込み、均等グリッドのフレーム幅・高さ・列数・行数・共通マージン・間隔を設定して検査する。最大128フレーム、mipレベル1〜5。警告行列とJSONを出力。入力画像や設定は外部送信・永続保存しない。

## 市場・選定理由
- 国内向け Unity 公式 [アトラス設定](https://docs.unity3d.com/ja/current/Manual/sprite/atlas/sprite-atlas-reference.html) はパディングを定義し、[ミップマップ](https://docs.unity3d.com/jp/current/Manual/texture-mipmaps-introduction.html) は縮小画像を説明する。制作工程の品質検査という用途がある。
- 海外の [Nerulio](https://nerulio.com/en/atlas-padding/) は端の押し出し、[ToolsFYI](https://www.toolsfyi.com/tools/design-tools/sprite-atlas-geometric-padding-clearance-audit) は幾何学的隙間、[Netwrck](https://ra.netwrck.com/tools/texture-seam-checker) は隙間と mip の目安、[Atlas Sampling Lab](https://quietkilntools.itch.io/atlas-sampling-lab) は補間サンプルと分離参照を扱う。
- 差別化仮説：間隔だけでなく実画素を使い、全フレーム×複数mipの箱フィルタ差を一覧化する。実需要や有料転換率は未測定。無料・ローカルQAとして「atlas mipmap bleeding」「スプライト にじみ」などの検索経由を検証する。
- 既存242アプリのディレクトリ名と mipmap / atlas / アトラス のコミット検索を確認（検索該当0件）。全README・ソースの照合は未実施。

## 計算モデル・限界
原点整列の2^L四角ブロック（画像端では切り詰め）について、アトラス全体の平均と、対象フレームの端を外側に延長した参照平均を比較する。プリマルチプライRGBA各チャンネルの最大絶対差。差があるブロック数・全交差数・最大差ブロックの座標を報告。しきい値は任意の数値で、視認性を保証しない。実GPUのmip寸法・sRGB線形化・UV・補間・圧縮・異方性・非均等配置・回転は未対応。画像の修正機能なし。画像デコード結果を検査するため元ファイルのバイト精度は対象外。

## テスト
- `node test.cjs`：固定アサーション、200入力×3レベルの独立参照計算（600件）、1024×1024・128フレーム×5レベル、合格。
- `python browser_test.py`：Chromium（Playwright・Pillow、HTMLインライン読み込み）でサンプル、PNG入力、JSON実ダウンロード、設定変更による結果無効化、不正入力、390px幅、JS例外と外部HTTP要求0件を確認。file URLは実行環境の管理制限で未検証。
- サンプルは4フレーム×4レベルの16セル中12セル警告。第1フレームの最大差は L1=0、L2=88、L3=44.56、L4=23.27。均一画像は全セル0。実エンジン・実素材の評価は未実施。
