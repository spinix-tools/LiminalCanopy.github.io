# AcousticPair / 共通観測時間

音響モニタリングの複数地点で、同時に録音できた区間だけを抽出するブラウザ内QA。`index.html` を開くだけで動作。登録・依存ライブラリ・通信不要。

## 対象と選定理由（2026-11-27調査）
- 日本：野鳥調査団体、大学、環境調査会社、市民科学。植田（2008）は24地点で夜行性鳥類の録音と聞き取りを用いた調査時刻を検討 https://doi.org/10.11211/birdresearch.4.T1 。HARKBirdは国内の音響観測・解析の実例 https://www.hark.jp/document/tutorial/2024/practice-HARKBird.html 。
- 海外：受動音響観測の調査設計では録音スケジュールが多様 https://doi.org/10.1002/rse2.131 。Open Ecoacousticsは録音プロトコル・サンプリング設計の記録を推奨 https://openecoacoustics.org/resources/metadata-standard/field_data/ 。
- 競合・関連：Song Meter Configuratorは予定録音カレンダーを表示 https://www.wildlifeacoustics.com/uploads/user-guides/html/Mini2-HTML5/en/song-meter-configurator-app-overview.html 。AudioMothは録音スケジュールと間欠録音を設定可能 https://doi.org/10.1016/j.ohx.2019.e00073 。HARKBirdは音源定位等の観測解析。差別化仮説は機種非依存の実績区間から全地点共通・ペア共通・最小連続長を抽出する前処理。需要の規模・支払意欲・競合の全機能は未検証。

## 操作
地点数2〜12（A〜L）、予定時間1〜604800秒、最小連続秒数を設定。共通原点からの整数秒で `station,start,end` CSVを貼り付け（最大20,000行、半開区間）。予定外をクリップし重複・隣接を統合。全地点の積集合とペア別積集合、未録音秒、最小長以上の連続区間を表示。CSVとJSONを出力。空地点も全地点の計算対象。入力変更時に旧結果を無効化する。

## テスト結果
`node test.cjs`：固定9アサーション合格、600合成ケースで独立した秒単位参照実装と一致（共通区間、最小長、地点・ペア秒数）。Chromium同一HTMLのインライン読み込み（file: は環境制限で拒否）：初期例、CSV/JSONダウンロード内容、閾値変更、旧結果無効化、不正CSV、リセット、390px幅のはみ出しなしを確認。JS例外・外部HTTP要求0件。初期例は全地点共通2300秒、300秒以上の連続区間2100秒。

## 限界・重複確認
録音ファイル自体は読まず、時刻同期・機材品質・検出率・時刻原点の正しさは保証しない。同時録音時間が等しくても生態学的な比較可能性は保証されない。個人情報や位置情報は不要。直近の制作履歴と専用ブランチ差分の51ディレクトリ名、関連4語のコミット検索を確認。全既存ソースの網羅比較は未実施。
