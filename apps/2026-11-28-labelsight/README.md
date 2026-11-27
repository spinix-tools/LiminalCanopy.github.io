# LabelSight / 展示視線ラボ

2026-11-28 MVP。美術館・博物館、展示会、内装・サイン制作担当者向け。`index.html` を保存してブラウザで開く（ビルド・登録・API不要）。寸法をmmで入力し、想定視点をTSVで最大12件指定して「比較計算」。提案反映、断面模式図、JSON出力、印刷に対応。

## 選定理由・市場
国内：横浜美術館のインクルーシブな什器・サイン設計、都市づくりパブリックデザインセンターの視距離別文字高さ、浜松市の近距離サイン設置高さの指針から、実務上の課題を確認。海外：BC Museums Associationは柵やラベルの角度が低い目線の鑑賞を妨げる事例を公開。米国NPSの展示設計資料も視距離と文字サイズ、遮蔽を扱う。需要の規模や支払意思は未検証。

- https://yokohama.art.museum/about/vision/renewal-points/furniture/
- https://www.udc.or.jp/pages/338/
- https://www.city.hamamatsu.shizuoka.jp/kokyoken/universal/sisin/ud021.html
- https://museum.bc.ca/brain/making-narratives-physically-accessible/
- https://www.nps.gov/features/hfc/guidelines/
- 競合：Digital Polo https://www.digitalpolo.com/tools/sign-letter-height/ 、AltFTool https://www.altftool.com/tools/all/text-legibility-distance-calculator 、Fengo https://fengo.pl/en/agency/tools/viewing-distance （主に視距離と文字高の換算）。

差別化仮説：垂直パネルの全体遮蔽・中心の文字角・中心への視線角を、複数視点について同時に検査し、候補高さの格子上で充足数最大の位置と全視点充足候補を求める。既存のCADや現地モックアップを補完する早期設計ツール。競合の全機能・独占性は未確認。無料の日本語ツールとして設計者への導入を検証し、将来は複数パネル比較等を検討。

## モデルと制限
壁をx=0、目を(x=d,y=eye)、矩形障害物を壁からnear〜near+width、床からbarとする。上下端への直線の障害物区間での最小高さを計算し、bar+clear以下を遮蔽とする。中心文字の上下端が張る角を分単位で算出。設定された文字角・視線角は任意の設計目標であり規格値ではない。候補高さの刻みを全探索し、充足数最大→現在値に近い→低い高さで決定。全充足範囲は離散候補。二次元・単一障害物・垂直パネル限定。横方向、斜面、反射、照度、視力、文字形状、実地検証、法令適合は対象外。設計判断には当事者との現地検証が必要。入力は外部送信・永続保存しない。個人情報を入力しないこと。

## テスト
`node test.cjs`：固定10項目、独立式・格子列挙との比較500ケース、最大12視点×3901候補の容量検査が合格。`python browser-test.py`（PlaywrightとChromiumが既にある環境）：サンプル0/3→3/3、中心1210mm（現在1100mm）、全充足候補1210〜1500mm、図切替、JSONダウンロード、反映、入力変更時無効化、不正入力、リセット、不成立例、390px幅の表示を確認。JS例外とHTTP要求0。環境のfile://制限により同一HTMLをインライン読み込み。実印刷・他ブラウザ・実機は未検証。

既存案との重複：直近会話の案、mainとの差分に含まれる51アプリディレクトリ、sightline/labelsight/展示/視線のコミット検索（各0件）を確認。全履歴・全ソースの網羅照合は未実施。
