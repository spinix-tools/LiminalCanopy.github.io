# CrossPatch / 黒マス修復ラボ
2026-11-26 | 静的Web MVP

## 対象・選定理由
クロスワード作家、教材制作、パズル編集者。国内のクロスワード.jpは黒マス配置と白マス連結のルールを解説し、Puzzle Print Labは日本語・英語の教材用自動生成を提供。海外のCrossFireは交差不足・短い語の警告、Crossword CompilerはGrid Insight、Exetはグリッド設計・自動充填を提供。制作・検査の需要を示す間接証拠であり、検索数・売上・支払意思は未確認。

## 差別化仮説
自動作問ではなく、既存の黒白配置をできるだけ残し、固定マスを保護したまま、ルールを満たす最少変更を全数提示する（最少距離2以内、表示12件まで）。日本式・米国式の例と個別設定で既存の作問工程に追加できる無料ツールを想定。競合の修復機能の不存在は未確認。専用ブランチの非切り詰めツリー248アプリ名、関連3語のコミット検索、直近履歴を確認。自転車変速案は既存Gearflow・ShiftWeaveと重複のため不採用。全READMEの網羅照合は未実施。

## 使用法
index.htmlをブラウザで開く。3〜15行・列の盤面をクリックまたはテキスト入力（. 白、# 黒、o 固定白、x 固定黒）。180度回転対称、黒マス隣接・四隅禁止、交差必須、最短語長2/3を選択。白マス連結・孤立禁止も検査。固定されていないマスの0・1・2個反転を順に全列挙し、最少の合法候補数を算出。プレビュー、適用、JSON保存、印刷。3個以上の修復、単語・ヒントの成立、出版先の全規則、解の一意性は対象外。語長1は語枠と数えない。交差率は指定最短語長以上の縦横両方を持つ白マス割合。登録・外部通信・有料APIなし。

## 検証
`node test.cjs`：固定8チェック、3×3全512盤面×3規則＝1536条件で独立検査・最少変更数・候補数照合、15×15上限を確認。`python browser_test.py`：Chromiumインライン読み込みで初期修復2マス・1候補、固定維持、プレビュー、JSON実ダウンロード、適用後違反0、入力エラー、固定編集、390px幅、JS例外・HTTP要求0。file://は環境制限で未確認。実際の作問・印刷・収益性は未検証。

## 調査リンク
- https://xn--pckua2c4hla2f.jp/ （クロスワード.jp）
- https://puzzleprintlab.com/crossword-maker
- https://github.com/katahiromz/XWordGiver/blob/master/README-JPN.md
- https://beekeeperlabs.com/crossfire/faq.html
- https://ftp.crossword-compiler.com/en/help/html/gridInsight.htm
- https://github.com/viresh-ratnakar/exet
