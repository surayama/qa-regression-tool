# QA回帰テストツール (c-diagnosis vs askman)

## 概要
Playwrightを使用してc-diagnosisエンジンとaskmanエンジンの問診結果を比較するQA回帰テストツール

## ディレクトリ構成

```
qa-regression-tool/
├── src/
│   ├── runners/PlaywrightQARunner.ts    # Playwright自動化ロジック (メイン)
│   ├── comparison/ComparisonEngine.ts   # 結果比較ロジック
│   ├── reporters/ReportWriter.ts        # レポート生成
│   └── types/index.ts                   # 型定義
├── reports/                             # 実行結果レポート (自動生成)
├── screenshots/                         # エラー時のスクリーンショット
└── test-comparison.ts                   # メイン実行ファイル
```

## 実行方法

```bash
# 全バックグラウンドプロセスkill (推奨)
killall -9 node chromium chrome

# テスト実行
npx ts-node test-comparison.ts
```

## 主な処理フロー

### test-comparison.ts
1. c-diagnosisとaskmanの2つのPlaywrightQARunnerを作成
2. 同じシード値(12345)で両エンジンを並列実行
3. ComparisonEngineで結果を比較
4. ReportWriterでreports/にレポート出力

### PlaywrightQARunner.ts (メインロジック)

#### 基本フロー
1. **ブラウザ初期化** - 開発者モードパラメータ付きでページロード & リロード
2. **基本情報入力** - 年齢、性別、主訴
3. **質問回答ループ** (answerQuestionsメソッド)
   - 設問文を取得
   - 選択肢を検出 (ボタンまたはdiv要素)
   - **設問文ベースで選択** (同じ設問なら同じ選択肢)
   - **「次へ」ボタンをクリック** (選択後に必須)
4. **結果画面へ到達** - goToResultメソッド
5. **病気リスト取得** - getDiseaseResultsメソッド

#### DOM要素検出ロジック
```typescript
// ボタン要素の検出
button:visible

// div要素の検出 (部位選択、頻度選択などのUI)
xpath=/html/body/div/div/main/div/div[3] 配下のみ
→ ナビゲーション要素を除外し、回答選択肢のみを対象
```

#### 設問文ベースの選択ロジック
```typescript
// 設問文を取得
const questionText = await page.locator('h1, h2, h3').textContent();

// 設問文をハッシュ化してインデックスを決定
const hash = hashString(questionText);
const index = (hash + seed) % optionCount;

// 決定論的に選択肢を選ぶ
await validButtons[index].click();
```

**重要**: 同じ設問文なら、c-diagnosisとaskmanで必ず同じ選択肢を選びます。これにより、質問の順序が異なっても結果を正確に比較できます。

## 出力

- `reports/` - テキストレポート (日時_シナリオ名.txt)
- `screenshots/` - エラー時のスクリーンショット

## 技術的な特徴

### 設問文ベースの決定論的選択
- 設問文をハッシュ化して選択肢インデックスを決定
- 同じ設問文なら、c-diagnosisとaskmanで必ず同じ選択肢を選ぶ
- 質問の順序が異なっても公平な比較が可能

### ブラウザ独立性
- 各テスト実行で新しいブラウザコンテキスト作成
- Cookie、LocalStorage、SessionStorageをクリア
- ユニークな`test_run_id`でキャッシュ回避

### エラーメッセージ日本語化
- すべてのエラーメッセージが日本語で表示
- デバッグが容易

## 削除済みの不要な機能
- replayモード
- GraphQLクライアント
- Mock runner
- ScenarioTestRunner
- ScenarioLoader
