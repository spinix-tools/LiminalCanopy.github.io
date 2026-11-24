# 穴幅 / ANAHABA — 2026-11-24

FDM 3Dプリントの穴径校正データから、軸との直径差が指定範囲に入るCAD穴径を逆算する単一HTML。`index.html` をブラウザで開くだけ。登録・外部通信・追加課金なし。

## ターゲット・選定理由
家庭用3Dプリンター利用者、メイカースペース、小規模試作工房。国内では[Japan RepRap Festival 2026の開催発表](https://prtimes.jp/main/html/rd/p/000000005.000163017.html)が2026年5月30–31日の2回目開催を告知。海外では[Prusa公式ガイド](https://help.prusa3d.com/article/modeling-with-3d-printing-in-mind_164135)が材料・向き・形状等で必要な公差が異なると説明。需要の間接指標であり、市場規模や有料需要は未確認。

## 競合・差別化仮説
日本語の[Bambu Studio XY補正計算機](https://yukidigitallab.com/tools/bambu-xy-dimension-compensation-calculator/)は実測平均から片側補正値を算出。海外の[OrcaSlicer](https://github.com/OrcaSlicer/OrcaSlicer/wiki/tolerance_calib)は試験モデルと穴補正、[GenerateSTL](https://www.generatestl.com/3d-print-tolerance-test/)はピン・穴の試験片生成と記録表を提供。差別化仮説は、スライサー設定を変えず複数設計径の実測最小・最大を区分線形補間し、軸径の幅と追加誤差を含めた直径差の上下限から、最悪側の余裕が最大のCAD穴径を選ぶこと。外挿は拒否し、不適合時は参考候補と明記する。既存apps一覧・関連8件のREADME冒頭を確認。フィラメント残量割当とは用途が異なる。全既存コード・競合全機能の比較は未実施。

## 操作・検証
2〜40校正行、0.01mm刻み探索、現在径比較、許容帯の図、上位10候補、全候補CSV。サンプルは現在10.25mmで直径差−0.075〜0.065mm、推奨10.49mmで0.1794〜0.3194mm、許容0.15〜0.35mm、適合5/151候補。Node.js固定10アサーション、300ランダム条件の独立端点照合60,300件・最良余裕/件数照合に合格。Chromiumインライン実行で編集・不適合・外挿拒否・不正入力・復元・CSV・390px幅を確認、JS例外・外部HTTP要求なし。`node test.cjs`、PlaywrightとChromium導入環境で `python test_browser.py`（配布ZIP同梱）。

## 制限・次の検証
実測範囲は統計的信頼区間でも保証値でもない。形状、真円度、測定器、材料、温度、造形方向、荷重の変化はモデル外。実際の挿入・造形・ファイルURLからの起動は未検証。安全重要部品には不使用。利用者5〜10名の試作で初回適合率・再印刷回数を比較することが次の需要検証。秘密情報・個人情報の収集なし。
