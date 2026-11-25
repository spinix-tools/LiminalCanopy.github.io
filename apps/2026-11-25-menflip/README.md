# 面継 / MENFLIP
カセット録音前に、曲順と必須曲を保持しながら、A/B面に収録する曲を選定するブラウザ用MVP。

## 対象と選定理由（2026-11-25調査）
- 国内のカセット愛好家、DJ、自主制作レーベル、海外のミックステープ制作者。2023年の国内生産本数は前年比2.4倍（ITmedia、2025-07-24、https://www.itmedia.co.jp/business/articles/2507/24/news009.html ）。2025年のCassette Week Japanは国内開催10年目（https://barks.jp/news/1001756/ ）。
- 英国では2025年に音楽カセット16.4万本が販売され前年比53%増（Official Charts、https://www.officialcharts.com/chart-news/best-selling-cassettes-singles-albums-2025/ ）。いずれも本アプリへの直接需要・支払意思の証明ではない。
- 競合: Mixtape Maker（https://mixtape-maker.com/mixtape ）は曲の手動配分・時間表示、Found（https://found-tools.com/en/cassette-tape-recording-timer/ ）は入力順の自動配分、MixTape Calculator（https://apps.apple.com/us/app/mixtape-calculator/id1087031743 ）は順次／best fit・曲間調整。単純な空き時間計算は既存機能。
- 差別化仮説: 曲順固定、必須曲、A/B面指定、左右別実測尺、安全余白、任意曲の重要度を同時に扱う。独立レーベル等が手作業で複数案を比較する時間を減らせるか検証する。先行224ディレクトリ名と cassette / カセット / mixtape / テープ のコミット検索を確認、該当コミットなし。全READMEは未照合。

## 使用方法・計算
`index.html` をブラウザで開き、例の形式で最大30曲を入力し計算。A/B面の録音開始・終了時刻、残り時間、未収録曲、CSVを得る。連続曲は一行の合計時間で入力可能（内部の曲間はその合計に含める）。各面の実測秒から安全余白を引く。曲間のみ指定秒を加算。各分割点について前方・後方ナップサックDPを計算し、優先度合計、使用秒数（曲間込み）、残り時間差の順で厳密最適化。同点は決定的な走査順。面の容量は最大3600秒。サンプルは5/6曲、29点、A面7:33、B面7:56、未収録「夜の散歩」。

## テスト・制限
- `node test.cjs`: 固定8件、独立3択全列挙との比較400件、最大30曲・3600秒×2、復元整合性に合格。
- `python browser-test.py`: Chromium（Playwright、環境のfile://制限によりHTMLインライン読み込み）で初期計算、CSV実ダウンロード、不正入力、解なし、結果無効化、再初期化、390px表示を確認。JS例外・外部HTTPリクエストなし。実機録音・印刷出力は未検証。
- 音源の取得・再生・録音、機器制御、著作権判断、テープ速度・伸びの補正は対象外。実需要、収益性、実録音での効果は未検証。外部API・課金・通信・データ収集なし。
