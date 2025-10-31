import * as fs from 'fs';
import * as path from 'path';
import { ComparisonResult } from './src/types';

interface FailurePattern {
  type: string;
  count: number;
  examples: string[];
}

const reportsDir = 'reports';
const jsonFiles = fs.readdirSync(reportsDir).filter(f => f.endsWith('.json'));

const failurePatterns: Record<string, FailurePattern> = {};

for (const file of jsonFiles) {
  const content = fs.readFileSync(path.join(reportsDir, file), 'utf-8');
  const result: ComparisonResult = JSON.parse(content);

  if (!result.passed) {
    const scenarioName = file.replace('.json', '').split('_').slice(1).join('_');

    // パターン1: 疾患の不一致
    if (result.differences.diseaseMismatch) {
      const dm = result.differences.diseaseMismatch;
      if (dm.cDiagnosisOnly && dm.cDiagnosisOnly.length > 0) {
        const key = 'disease_only_in_c-diagnosis';
        if (!failurePatterns[key]) {
          failurePatterns[key] = { type: '疾患がc-diagnosisにのみ存在', count: 0, examples: [] };
        }
        failurePatterns[key].count++;
        if (failurePatterns[key].examples.length < 5) {
          const diseases = dm.cDiagnosisOnly.map(d => d.name).join(', ');
          failurePatterns[key].examples.push(scenarioName + ': ' + diseases);
        }
      }

      if (dm.askmanOnly && dm.askmanOnly.length > 0) {
        const key = 'disease_only_in_askman';
        if (!failurePatterns[key]) {
          failurePatterns[key] = { type: '疾患がaskmanにのみ存在', count: 0, examples: [] };
        }
        failurePatterns[key].count++;
        if (failurePatterns[key].examples.length < 5) {
          const diseases = dm.askmanOnly.map(d => d.name).join(', ');
          failurePatterns[key].examples.push(scenarioName + ': ' + diseases);
        }
      }
    }

    // パターン2: 質問数の不一致
    if (result.differences.questionCountMismatch) {
      const key = 'question_count_mismatch';
      if (!failurePatterns[key]) {
        failurePatterns[key] = { type: '質問数の不一致', count: 0, examples: [] };
      }
      failurePatterns[key].count++;
      if (failurePatterns[key].examples.length < 5) {
        const qcm = result.differences.questionCountMismatch;
        const details = 'c-diagnosis=' + qcm.cDiagnosis + ', askman=' + qcm.askman;
        failurePatterns[key].examples.push(scenarioName + ': ' + details);
      }
    }

    // パターン3: 結果ページ要素の不一致
    if (result.differences.resultPageElementsMismatch) {
      const rpm = result.differences.resultPageElementsMismatch;

      if (rpm.banners) {
        const key = 'result_page_banners_mismatch';
        if (!failurePatterns[key]) {
          failurePatterns[key] = { type: '結果ページバナーの不一致', count: 0, examples: [] };
        }
        failurePatterns[key].count++;
        if (failurePatterns[key].examples.length < 5) {
          failurePatterns[key].examples.push(scenarioName + ': ' + JSON.stringify(rpm.banners));
        }
      }

      if (rpm.buttons) {
        const key = 'result_page_buttons_mismatch';
        if (!failurePatterns[key]) {
          failurePatterns[key] = { type: '結果ページボタンの不一致', count: 0, examples: [] };
        }
        failurePatterns[key].count++;
        if (failurePatterns[key].examples.length < 5) {
          failurePatterns[key].examples.push(scenarioName + ': ' + JSON.stringify(rpm.buttons));
        }
      }

      if (rpm.sections) {
        const key = 'result_page_sections_mismatch';
        if (!failurePatterns[key]) {
          failurePatterns[key] = { type: '結果ページセクションの不一致', count: 0, examples: [] };
        }
        failurePatterns[key].count++;
        if (failurePatterns[key].examples.length < 5) {
          failurePatterns[key].examples.push(scenarioName + ': ' + JSON.stringify(rpm.sections));
        }
      }
    }

    // パターン4: 実行エラー
    if (result.cDiagnosisResult?.error || result.askmanResult?.error) {
      const key = 'execution_error';
      if (!failurePatterns[key]) {
        failurePatterns[key] = { type: '実行エラー', count: 0, examples: [] };
      }
      failurePatterns[key].count++;
      if (failurePatterns[key].examples.length < 5) {
        const errors = [];
        if (result.cDiagnosisResult?.error) errors.push('c-diagnosis: ' + result.cDiagnosisResult.error);
        if (result.askmanResult?.error) errors.push('askman: ' + result.askmanResult.error);
        failurePatterns[key].examples.push(scenarioName + ': ' + errors.join('; '));
      }
    }
  }
}

console.log('\n📊 50シナリオテスト失敗パターン分析\n');
console.log('='.repeat(80));

const sortedPatterns = Object.entries(failurePatterns)
  .sort((a, b) => b[1].count - a[1].count);

let totalIssues = 0;
for (const [key, pattern] of sortedPatterns) {
  totalIssues += pattern.count;
  console.log('\n🔍 ' + pattern.type);
  console.log('   件数: ' + pattern.count + '件');
  console.log('   例:');
  for (const example of pattern.examples) {
    console.log('     - ' + example);
  }
}

console.log('\n' + '='.repeat(80));
console.log('\n合計失敗パターン: ' + Object.keys(failurePatterns).length + '種類');
console.log('合計問題箇所: ' + totalIssues + '件\n');
