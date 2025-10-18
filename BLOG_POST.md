# Claude Codeと2日間でQA回帰テストツールを作った話

こんにちは、Mayです！

木曜日と金曜日の2日間で、Claude Codeと一緒に「qa-regression-tool」という問診エンジンの回帰テストツールを作りました。私がやったことは**やりたいことをリクエストし続けるだけ**で、コードはすべてClaude Codeが書いてくれました。

この記事では、どんなツールができたのか、どうやって作ったのかを共有します！

---

## 🎯 作ったもの：QA回帰テストツール

### 背景

Ubieの問診エンジンは、現在2つのエンジンが動いています：

- **c-diagnosis**: 既存エンジン
- **askman**: 新しいエンジン

このツールは、両エンジンで同じシナリオを実行して、結果を自動比較するものです。

### 主な機能

✅ **Playwright自動化** - ブラウザ操作を完全自動化（クリック、入力、画面遷移など）
✅ **並列実行** - 2つのエンジンを同時にテスト
✅ **決定論的テスト** - 同じシード値で再現可能なテスト
✅ **詳細レポート** - テキスト & JSON形式で出力
✅ **109シナリオ対応** - 年齢・性別・主訴の組み合わせ
✅ **高速実行** - 1シナリオあたり約60-80秒で完了

---

## 📂 プロジェクト構成

```
qa-regression-tool/
├── src/
│   ├── runners/PlaywrightQARunner.ts    # メインのテスト実行ロジック
│   ├── comparison/ComparisonEngine.ts   # 結果比較エンジン
│   ├── reporters/ReportWriter.ts        # レポート生成
│   └── types/index.ts                   # TypeScript型定義
├── reports/                             # 実行結果レポート (自動生成)
├── screenshots/                         # エラー時のスクリーンショット
├── scenarios-updated.ts                 # 109個のテストシナリオ定義
└── test-comparison.ts                   # メイン実行ファイル
```

---

## 🚀 使い方

### インストール

```bash
npm install
```

### テスト実行

```bash
# バックグラウンドプロセスをクリア（推奨）
killall -9 node chromium chrome

# テスト実行
npx ts-node test-comparison.ts
```

### 出力

- `reports/` - 詳細なテキストレポート
- `reports/` - JSON形式のレポート
- `screenshots/` - エラー時のスクリーンショット

---

## 🧠 技術的なポイント

### 1. **決定論的テスト設計**

問診の質問は動的に変わるため、「同じ質問には同じ回答をする」仕組みが必要でした。

**解決策：設問文ベースのハッシュ化**

```typescript
private getRandomIndexForQuestion(questionText: string, optionCount: number): number {
  // 設問文をハッシュ化
  let hash = 0;
  for (let i = 0; i < questionText.length; i++) {
    hash = ((hash << 5) - hash) + questionText.charCodeAt(i);
    hash = hash & hash;
  }

  // シード値と組み合わせて決定論的に選択
  const combined = Math.abs(hash + this.randomSeed);
  return combined % optionCount;
}
```

#### 仕組みの詳細

**1. 設問に出会うたびにその場でハッシュ化**

ハッシュ値はどこにも保存されず、設問に遭遇するたびに計算されます：

```
シナリオ実行開始 (シード値: 12345 をメモリに保持)
  ↓
Q1: "誰の症状について調べますか？"
  → hash("誰の症状について調べますか？") = 987654321
  → (987654321 + 12345) % 3 = 1
  → "家族" を選択
  ↓
Q2: "年齢を教えてください"
  → hash("年齢を教えてください") = 1234567890
  → (1234567890 + 12345) % 100 = 35
  → "35歳" を入力
  ↓
Q3: "頭痛はいつからですか？"
  → hash("頭痛はいつからですか？") = 2345678901
  → (2345678901 + 12345) % 4 = 2
  → "1週間前" を選択
```

**2. ハッシュ関数が「ランダムっぽい分散」を生成**

DJB2アルゴリズムの変形を使用しており、似た文字列でも全く異なるハッシュ値が生成されます：

```
"頭痛はいつからですか？" → hash = 1834567890
"頭痛の程度は？"         → hash = 987654321  (全然違う値)
"痛みはいつからですか？" → hash = 2145678901 (1文字違うだけで大きく変わる)
```

モジュロ演算（`%`）により、大きなハッシュ値を選択肢の範囲（0〜N）に圧縮することで、「ランダムっぽく」分散した選択が実現されます。

**3. シナリオごとに異なるパターン**

```typescript
// シナリオ1: シード 12345
"体重を教えてください" → 55kg

// シナリオ2: シード 13345（シード値が違う）
"体重を教えてください" → 87kg  ← 同じ設問でも違う値
```

#### メリット

- ✅ **メモリ効率**: シード値（1つの数字）だけ保持すればOK
- ✅ **シンプル**: 複雑な状態管理が不要
- ✅ **再現可能**: 同じシード値なら、いつでも同じパターンを再現
- ✅ **公平な比較**: c-diagnosisとaskmanで質問順序が違っても、同じ設問には同じ回答

### 2. **Playwrightによるブラウザ自動化**

[Playwright](https://playwright.dev/)を使用して、実際のブラウザ操作を完全に自動化しています：

- ✅ ボタンクリック
- ✅ テキスト入力
- ✅ ドロップダウン選択
- ✅ ページ遷移の待機
- ✅ エラー時のスクリーンショット取得

各テスト実行で完全にクリーンな状態を保証：

```typescript
const context = await this.browser.newContext({
  ignoreHTTPSErrors: true,
  serviceWorkers: 'block',
  storageState: undefined,
  extraHTTPHeaders: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
  },
});

// ストレージをクリア
await page.evaluate(() => {
  localStorage.clear();
  sessionStorage.clear();
});
```

### 3. **実行速度**

**1シナリオあたり約60-80秒**で完了します。

これは、2つのエンジン（c-diagnosisとaskman）を並列実行した場合の時間です：
- 30問程度の質問に回答
- 結果画面まで到達
- 疾患リストを取得
- レポート生成

109シナリオ全体を実行すると、約2〜2.5時間程度で完了します。

### 4. **開発者モードの活用**

toc-e2eテストの調査結果を元に、以下のパラメータを使用：

```
?iam_ubie_developer=1     # 開発者モード有効化
&test_run_id=${timestamp}  # キャッシュ回避
&force_repeater=1          # Cookie チェック回避
&sandbox_mode=1            # テスト環境モード
&use_askman_qa=1          # askmanエンジン有効化（askmanのみ）
```

### 5. **テストシナリオの管理**

109個のシナリオは[scenarios-updated.ts](scenarios-updated.ts)ファイルに保存されています：

```typescript
export const scenarios: TestScenario[] = [
  {
    name: '35歳男性・熱がある',
    user: { age: 35, sex: 'male', relationship: 'myself' },
    complaints: [{ id: 'fever', text: '熱がある' }],
    answers: []
  },
  {
    name: '28歳女性・体がだるい',
    user: { age: 28, sex: 'female', relationship: 'myself' },
    complaints: [{ id: 'fatigue', text: '体がだるい' }],
    answers: []
  },
  // ... 全109シナリオ
];
```

各シナリオには以下の情報が含まれます：
- **name**: シナリオ名（レポートファイル名に使用）
- **user**: 年齢・性別・関係性
- **complaints**: 主訴（問診開始時に入力される症状）
- **answers**: 固定回答リスト（将来的な拡張用）

**シナリオの作成方法**: 主訴のリストをClaude Codeに共有するだけで、自動的にこのファイルを生成してくれました。

### 6. **固定回答の設定**

テストを安定させるため、一部の設問には固定の回答を設定しています：

#### ✅ サインアップ確認ページ
```typescript
// 「いいえ、結果を保存しなくてよい」を選択
// 理由: アカウント作成を避けて、問診結果だけを取得するため
```

#### ✅ 症状回答継続ページ
```typescript
// 「ここまでの回答で結果を見る」を選択
// 理由: 質問を途中で打ち切って、早く結果画面に到達するため
```

これらの固定回答により、テストが結果画面まで確実に到達できるようになっています。

### 7. **詳細なログ記録**

各質問ごとに以下を記録：

```typescript
interface QuestionLog {
  questionNumber: number;
  url: string;
  questionText?: string;
  availableOptions: string[];
  selectedOption?: string;
  timestamp: number;
}
```

これにより、エラー発生時に「どこで何が起きたか」を正確に追跡できます。

---

## 📊 実行結果の例

### 成功例：28歳女性・吐き気

```
✅ MATCH - Both engines produced similar results

C-Diagnosis: 13 diseases, 28 questions
Askman:      13 diseases, 32 questions

Question Count Mismatch:
  C-Diagnosis: 28
  Askman: 32
  Difference: askman asked 4 more questions
```

### 差分例：25歳女性・頭痛

```
❌ FAILED - Results differ

C-Diagnosis: 10 diseases, 34 questions
Askman:      10 diseases, 32 questions

Disease Differences:
  Only in c-diagnosis: 月経困難症, リウマチ性多発筋痛症
  Only in askman: 急性扁桃炎・咽頭炎

Question Count Mismatch:
  C-Diagnosis: 34
  Askman: 32

詳細な質問ログ比較:
  [C-Diagnosis Q1]
    URL: https://staging.ubie.app/qa/relationship
    Question: 誰の症状について調べますか？
    Selected: 自分

  [Askman Q1]
    URL: https://staging.ubie.app/qa/question/person
    Question: 誰の症状について調べますか？
    Selected: 自分

  ⚡️  DIFFERENCES: URL differs
```

### エラー例：32歳女性・皮膚の異常

```
❌ FAILED - Results differ

C-Diagnosis: 10 diseases, 34 questions
Askman:      0 diseases, 7 questions ⚠️ ERROR

Askman Error:
  結果ページに到達できませんでした。
  停止位置: /qa/question/skin_condition_photo
  📸 Screenshot: screenshots/error-askman-1760684779801.png
```

---

## 🔍 差分検知と分析結果

109シナリオを実行した結果、Claude Codeが以下の差分を検知しました：

### 検知された主要な差分パターン

#### 1. **タバコの設問**
askmanだけに出現する質問

#### 2. **生活習慣病の設問**
c-diagnosisだけに出現する質問

#### 3. **疾患の重複排除**
askmanで「回答に関連する病気」と「見逃されやすい病気」の重複排除ができていない

#### 4. **URL構造の差異（仕様）**
- c-diagnosis: `/qa/age`
- askman: `/qa/question/age`
- ※これは実装の差異であり、バグではない

### 🤔 判断が難しい状況

上記の差分が存在するため、**その他の差分がバグかどうかの判断が困難**な状況です：

- **質問数の差異**: タバコ・生活習慣病の質問差により説明可能
- **疾患リストの差異**: 質問の回答が異なると結果画面の疾患も変わるため、多数の差分が出るが、これがバグなのか仕様なのか判断できない
- **疾患数の完全一致は期待できない**: 質問フローが異なるため、比較が困難

### 📊 分析結果サマリー

```
✅ レポート109件を分析
🔍 上記4つの主要な差分パターンを検知
⚠️  その他の差分は、これらの問題に起因している可能性が高く、
   新規バグかどうかの判断は困難
```

つまり、**既知の問題が存在することで、新規バグの検出が阻害されている**状態です。
これらの既知の問題を解決すれば、より正確な回帰テストが可能になると考えられます。

---

## 💡 開発について

このツールは、Claude Codeを使用して開発しました。
私はコーディングをせず、「こういう機能が欲しい」とリクエストするだけで、コードはすべてClaude Codeが書いてくれました。

開発期間：2日間（実質的なコーディング時間は0分）

---

## 📈 成果

### 定量的な成果

- **109シナリオ** のテストケースを自動実行
- **レポート109件** を自動生成
- **主要な差分パターン4件** を検知

### 定性的な成果

- **回帰テストの自動化** が実現
- **エンジン間の差異** を定量的に把握
- **再現可能なテスト** により、バグ調査が容易に

---

## 🎓 次のステップ

### 現状と今後の運用

現在はローカル環境で実行できる状態です。既知の問題（タバコ・生活習慣病の設問差異など）が修正されたら、空き時間にガンガン回してテストを継続していきます。

### 改善したいこと

#### 1. **GitHub Actionsでの自動実行**
- 現在はローカルでしか動かない
- GitHub Actionsで自動実行できるようにして、定期的にテストを回したい
- PR作成時に自動テストも検討

#### 2. **シナリオの拡充**
- より多様なパターンをカバー
- エッジケースの追加
- 小児・高齢者など、特定の年齢層に特化したシナリオ強化

#### 3. **検出項目の拡充**
- 現在: ボタンの有無、結果画面の疾患リスト
- 追加したい: 結果画面の疾患以外の要素（表示順、ラベル、UIコンポーネントなど）も比較対象に
- より詳細な差分検知を実現

---

## 🙏 まとめ

2日間で、c-diagnosisとaskmanの回帰テストを自動化するツールを作成しました。

このツールにより：
- 両エンジンの動作を並列比較できる
- 差分を定量的に把握できる
- 再現可能なテストにより、バグ調査が容易になる

今後、既知の問題が解決されれば、より正確な回帰テストが可能になると考えています。

---

## 📚 参考リンク

- [Playwright公式ドキュメント](https://playwright.dev/)
- [Claude Code公式サイト](https://claude.ai/claude-code)
- [TypeScript公式ドキュメント](https://www.typescriptlang.org/)

