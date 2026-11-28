# MonoMargin / モノラル配合ラボ
2026-11-28 MVP。DTM・ポッドキャスト制作者、小規模PA、音声入稿担当者向け。ステレオとは別のモノラル版を作る際の検討用。index.html をブラウザで開く。外部通信・登録・録音・依存ライブラリなし。

## 市場・選定理由
- 国内：DTM DRIVER!（2026-09-07）はモノラル合算で音が痩せる問題を解説 https://dtmdriver.com/mix-phase-shift 。Waves Japanも複数マイクの位相問題を解説 https://wavesjapan.jp/articles/tips-for-fixing-phase-problems-in-your-mix/ 。
- 海外：OneTaskは時間別相関・モノラル出力・極性反転 https://onetask.tools/media/phase-checker/ 、AudioWrenchは窓別相関・モノラル試聴・レポート https://audiowrench.com/tools/stereo-phase-checker 、TuneLensは帯域別相関 https://tunelens.com/stereo-phase-checker.html 。
- 差別化仮説：診断だけでなく、左右偏り上限と最低保持量を指定し、目標を満たす最も50:50に近い固定配合を探索。未達の場合は最悪窓を最大化。標準との試聴・CSV・WAV出力を一体化。競合の全機能、利用者数、支払意欲は未検証。
- 重複確認：専用ブランチのapps一覧、音響関連README 7件、直近履歴を確認。コミット検索はAPIの400で不可。全既存ソースの網羅照合ではない。

## 操作・計算
ステレオPCM16 WAV（8–96kHz、60MiB以下、600秒以内）または合成サンプルを選ぶ。0.25/1/2秒窓、偏り上限0–50ポイント、目標−30〜0dBを指定し解析。窓の保持量は 10 log10(sum((pL+(1-p)R)^2)/sum((L^2+R^2)/2))、−120dBで下限表示。最大窓エネルギーの−35dB未満を除外し、整数%候補を全探索。最大保持量は正の場合もある。WAV出力は丸めたPCM16。元音源は不変。ファイル名・音声は外部送信しない。

## 検証
- `node test.cjs`：固定アサーション、100生成ケースの直接サンプル合算と候補探索、出力32000サンプル照合に合格。
- `python test_browser.py`：ChromiumでWAV読込・WAV/CSV実ダウンロード・試聴URL生成・不正入力・旧結果無効化・390px幅を確認。JS例外/HTTP要求なし。file://は環境の管理ポリシーで拒否されたため、同一HTMLのset_contentで検証。
- 合成4秒：50:50の完全相殺窓は−120dB表示、目標−6dB・偏り30で76:24、最悪窓−5.68dB。
- 限界：重要な声・楽器の保存、主観音質、LUFS、周波数別分析、他形式・他ブラウザ・最大サイズ実測、実音源での聴取は未検証。元のステレオを修復する機能ではなく、別モノラルミックス候補の検討用。偏りは一方の内容を失わせる可能性がある。
