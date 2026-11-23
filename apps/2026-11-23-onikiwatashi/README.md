# 音域渡し / ONIKI WATASHI

学校・市民吹奏楽の移調確認と概算音域チェック用、完全ローカルで動作するブラウザMVP。2026-11-23 制作。MIT License。

## 使い方と機能
1. `index.html` を開く。C4/1 D4/0.5 F#4/2 R/1 のように音名と拍を入力する（最大96音）。
2. 入力が実音か、B♭クラリネット等の記譜音か選ぶ。
3. 最大6楽器を選び、記譜音の一括変換、概算音域外の警告、音高グラフとオクターブ案を確認する。
4. 実音をWeb Audioで試聴し、MIDI、比較CSV、JSONを保存。JSONの読み込み、印刷、端末内自動保存にも対応。

**制約**: オクターブ提案は実音まで変える編曲案であり、元の音を保つ移調ではない。異名同音の音楽理論上の綴り・調号・清書には未対応。音域は標準的な目安にすぎず、奏者によって変わる。外部通信、アカウント、音声収録、OpenAI APIは不要。

## ターゲット・市場・競合と差別化（2026-11-23 調査）
- ターゲット: 学校・市民バンドの指導者、編曲初学者、アンサンブルの奏者。
- 需要の根拠: [2025-11-11報道](https://www.nippon.com/ja/articles/-/10300)による2024年全日本吹奏楽連盟加盟は13,226団体。[2026-10-23 マイナビ発表](https://www.mynavi.jp/sponsorship/news/2026/10/post_55020.html)でも約13,000団体とされる。これはアプリ需要や支払意思を示す数字ではない。
- 国内競合: [トランスノート](https://apps.apple.com/jp/app/id6763399152)（音名移調）、[ScoreLens](https://scorelens.app/ja)（譜面読取・試聴）。
- 海外競合: [ToMIDI](https://tomidi.org/transpose-sheet-music)（楽譜移調・音域）、[Arpelio](https://www.arpelio.com/)（楽器別指使い付き教材）、[Tonalics](https://tonalics.com/transpose)（簡易音名移調）。
- **差別化仮説**: MusicXMLやPDFの準備前に、音名の断片を貼って複数楽器の音域を同時比較し、「響く音が変わる代替オクターブ」を正確に区別できる小さな編曲用作業台。需要・収益性は未検証。

## 実装・検証結果
- GitHub版: 依存ゼロの**単一HTMLの軽量実装**。実ブラウザ起動・操作テストは未検証、GitHub再取得と静的確認のみ。
- 同時制作したローカル配布の完全版（`index.html`, `engine.js`, `app.js`, `style.css` の分割ソースおよび `standalone.html`）で、Node.js単体テスト **22/22**、固定シードランダム検証 **1,200系列**、Chromium DOM操作 **30/30** 合格。MIDI/CSV/JSONダウンロード、再生停止、画面幅390pxを検証。
- ローカルChromium環境では `file://` / localhost の直接遷移が制限されたため、**同一CSS/JSをインライン実行**し、localStorageをメモリで模擬した。通常ブラウザでの直接起動、実演奏精度、Github版の実操作は未検証。
- GitHub軽量版と配布完全版は**別実装**で、テスト実績を混同しない。完全版はこの実行のZIP成果物に同梱。
- 外部API・個人情報収集・有料サービス・新規課金なし。

## 検証の再実行（完全版）
```bash
node test-engine.js
python test-browser.py  # playwright + /usr/bin/chromium が必要
```
