# 結果画面要素の表示条件分析

ofroリポジトリのコードを調査して、各要素が固定表示か動的表示かを分析しました。

## 🟢 固定表示（常に表示される要素）

### 1. SNS共有ボタン (Twitter, LINE)
**ファイル**: `src/components/qa/result/QaResultSnsShareSection.tsx`

**表示条件**:
```tsx
{!isSnsShareDisabledService && (
  <QaResultSnsShareSection ... />
)}
```

**判定結果**: ✅ **固定表示**
- `isSnsShareDisabledService()` は常に `false` を返す (ExternalServiceService.ts:56-59)
- コメント: "SNSシェアNGの外部サービスが再出現した際に改めて対応するのが面倒になるので、関数は残したまま固定値の返却とした"

**検出方法**:
```typescript
social: {
  twitter: true,  // 常にtrue
  line: true,     // 常にtrue
}
```

---

## 🟡 動的表示（条件によって表示される要素）

### 2. 会員登録バナー (membership-plus-banner)
**data-testid**: `membership-plus-banner`

**表示条件**: 調査中（ログイン状態による可能性が高い）

**検出方法**:
```typescript
banners: {
  membershipPlus: boolean  // 動的
}
```

### 3. 病院検索ボタン
**ID**: `12`
**テキスト**: "症状にあった病院を探す"

**表示条件**: 調査中

**検出方法**:
```typescript
buttons: {
  hospitalSearch: boolean  // 動的
}
```

### 4. 市販薬セクション (OTC)
**ID**: `otcSection`
**ファイル**: `src/components/qa/result/otc/OtcSection.tsx`

**表示条件**:
```tsx
{otcSetting !== null && <OtcSection ... />}
```

**判定結果**: 🟡 **動的表示**
- `otcSetting` は `getOtcSetting()` の結果による
- 特定の症状・条件でのみ表示

**検出方法**:
```typescript
sections: {
  otc: boolean  // 動的
}
```

### 5. 関連疾患セクション
**ID**: `answerRelatedDiseases`

**表示条件**: 疾患リストが存在する場合

**検出方法**:
```typescript
sections: {
  relatedDiseases: boolean  // 動的
}
```

### 6. ユビー機能ボタン群
**表示条件**: 調査中（全て固定表示の可能性あり）

**ボタン一覧**:
- いますぐ取れる対処法
- 病院に行くべきか知りたい
- 何科に行くべきか知りたい
- 適切な対処法を知りたい
- 病気や症状について詳しく知りたい
- 受診したがまだ悩みがある

**検出方法**:
```typescript
buttons: {
  ubieActions: string[]  // 動的（表示されるボタンのリスト）
}
```

### 7. 広告バナー
**URL**: `freakout-api-stub` を含む画像

**表示条件**: 広告配信設定による

**検出方法**:
```typescript
banners: {
  ads: string[]  // 動的（表示される広告URLのリスト）
}
```

---

## 📊 まとめ

### 固定表示 (常にあるべき要素)
- ✅ Twitter共有ボタン
- ✅ LINE共有ボタン

### 動的表示 (差分検出が有用)
- 🟡 会員登録バナー
- 🟡 アプリダウンロードバナー
- 🟡 広告バナー
- 🟡 病院検索ボタン
- 🟡 ユビー機能ボタン群
- 🟡 市販薬セクション
- 🟡 関連疾患セクション
- 🟡 治療情報セクション

---

## 🔍 次のアクション

### 固定要素の扱い
SNS共有ボタンは**常に表示されるべき**なので:
1. ✅ 検出は継続（回帰テストとして有用）
2. ✅ 差分があった場合は**警告**として扱う（failにしない）
3. ✅ レポートには出力する

### 動的要素の扱い
他の要素は条件によって表示が変わるため:
1. ✅ 検出を継続
2. ✅ c-diagnosisとaskmanで差分があっても**警告**として扱う
3. ✅ レポートで差分を明示

### コード調査が必要な項目
- [ ] 会員登録バナーの表示条件
- [ ] 病院検索ボタンの表示条件
- [ ] ユビー機能ボタンが全て固定表示かどうか
- [ ] アプリダウンロードバナーの表示条件

---

## 📝 参考ファイル

- `src/components/qa/result/QaResultSection.tsx` - メイン結果画面
- `src/components/qa/result/SnsShareSection.tsx` - SNS共有コンポーネント
- `src/components/qa/result/QaResultSnsShareSection.tsx` - QA結果用SNS共有ラッパー
- `src/hooks/useIsSnsShareDisabledService.ts` - SNS共有無効化フック
- `src/services/ExternalServiceService.ts` - 外部サービス判定（常にfalse）
- `src/components/qa/result/otc/OtcSection.tsx` - 市販薬セクション
