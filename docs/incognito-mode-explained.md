# `--incognito` フラグの仕組み

## 概要

`--incognito` は Chromium のコマンドラインフラグで、ブラウザを「シークレットモード」で起動します。

## 通常モード vs シークレットモード

### 通常モード（`--incognito` なし）

```
ブラウザ起動
  ↓
ユーザープロファイルを読み込む
  ↓
以下が保持される:
  - Cookie
  - localStorage
  - sessionStorage
  - IndexedDB
  - Service Workers
  - HTTP Cache
  - 閲覧履歴
  - 自動入力データ
  - パスワード
```

### シークレットモード（`--incognito` あり）

```
ブラウザ起動
  ↓
一時的なプロファイルを作成
  ↓
以下がクリーンな状態:
  - Cookie: なし
  - localStorage: なし
  - sessionStorage: なし
  - IndexedDB: なし
  - Service Workers: なし
  - HTTP Cache: メモリのみ（ディスクに保存されない）
  - 閲覧履歴: 記録されない
  ↓
ブラウザ終了時
  ↓
一時プロファイルを完全削除
```

## なぜこれが重要か？

### 問題: ブラウザの状態が引き継がれる

```typescript
// --incognito なしの場合

// 1回目の実行
await browser.launch();  // ← デフォルトプロファイルを使用
// タバコの質問に「吸わない」と回答
// → Cookie や localStorage に保存される可能性

await browser.close();

// 2回目の実行
await browser.launch();  // ← 同じプロファイルを再利用
// → 前回の回答が残っているため、タバコの質問がスキップされる
```

### 解決: 毎回クリーンな状態

```typescript
// --incognito ありの場合

// 1回目の実行
await browser.launch({ args: ['--incognito'] });
// ← 一時プロファイル #1 を作成
// タバコの質問に回答
await browser.close();
// ← 一時プロファイル #1 を削除

// 2回目の実行
await browser.launch({ args: ['--incognito'] });
// ← 新しい一時プロファイル #2 を作成（前回とは完全に別）
// → 前回の情報は一切残っていない
// タバコの質問が必ず出る
```

## 実際の動作確認

### 通常モード

```bash
# Cookie が保存される場所
~/Library/Application Support/Chromium/Default/Cookies

# localStorage が保存される場所
~/Library/Application Support/Chromium/Default/Local Storage/
```

これらのファイルは**ブラウザを閉じても残る**

### シークレットモード

```bash
# 一時ディレクトリに作成される
/var/folders/xx/xxxxxxxxx/T/scoped_dirXXXXX/Default/

# ブラウザ終了時に完全削除される
```

## Playwright での使用例

### 修正前（問題あり）

```typescript
const browser = await chromium.launch({
  headless: true,
});
// → デフォルトプロファイルを使用
// → 前回の実行の情報が残る可能性
```

### 修正後（安全）

```typescript
const browser = await chromium.launch({
  headless: true,
  args: ['--incognito'],
});
// → 一時プロファイルを使用
// → 毎回完全にクリーンな状態
```

## その他のメリット

### 1. テストの独立性
各テスト実行が完全に独立するため、テスト結果が安定する

### 2. 並列実行の安全性
複数のブラウザインスタンスを並列実行しても、互いに干渉しない

### 3. デバッグの容易さ
「前回の実行の影響」を考慮する必要がなくなる

## まとめ

`--incognito` フラグは、**毎回まっさらな状態でブラウザを起動する**ための仕組みです。

これにより:
- ✅ Cookie やストレージが引き継がれない
- ✅ タバコの質問が安定して出る
- ✅ テスト結果が再現可能になる
