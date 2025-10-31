import { PlaywrightQARunner } from './src/runners/PlaywrightQARunner';
import { ComparisonEngine } from './src/comparison/ComparisonEngine';
import { ReportWriter } from './src/reporters/ReportWriter';
import { TestScenario } from './src/types';

/**
 * question-16275の特別処理が正しく動作することを確認するテスト
 * 両エンジンで「この中に該当なし」などの安全な選択肢が選ばれることを検証
 */
async function testQuestion16275() {
  const scenario: TestScenario = {
    name: '20歳男性・頭痛がする',
    user: { age: 20, sex: 'male', relationship: 'myself' },
    complaints: [{ id: 'headache', text: '頭痛がする、頭が重い' }],
    answers: [],
  };

  const baseUrl = 'https://staging.ubie.app';
  const comparisonEngine = new ComparisonEngine();
  const reportWriter = new ReportWriter('./reports');

  console.log('🧪 question-16275の特別処理テスト開始');
  console.log('');

  // C-Diagnosis実行
  console.log('📍 C-Diagnosis実行中...');
  const cRunner = new PlaywrightQARunner(baseUrl);
  cRunner.setEngine('c-diagnosis');
  cRunner.setRandomSeed(12345);
  await cRunner.init(true);
  const cResult = await cRunner.runScenario(scenario);
  await cRunner.close();
  console.log(`✅ C-Diagnosis完了 - 疾患数: ${cResult.diseases.length}, 質問数: ${cResult.questionCount}`);
  console.log('');

  // Askman実行
  console.log('📍 Askman実行中...');
  const aRunner = new PlaywrightQARunner(baseUrl);
  aRunner.setEngine('askman');
  aRunner.setRandomSeed(12345);
  await aRunner.init(true);
  const aResult = await aRunner.runScenario(scenario);
  await aRunner.close();
  console.log(`✅ Askman完了 - 疾患数: ${aResult.diseases.length}, 質問数: ${aResult.questionCount}`);
  console.log('');

  // question-16275の選択肢を確認
  console.log('🔍 question-16275の選択肢をチェック:');
  const cQ16275 = cResult.questionLogs?.find(q => q.url.includes('question-16275'));
  const aQ16275 = aResult.questionLogs?.find(q => q.url.includes('question-16275'));

  if (cQ16275) {
    console.log(`  C-Diagnosis: ${cQ16275.selectedOption}`);
  } else {
    console.log('  C-Diagnosis: question-16275が見つかりません');
  }

  if (aQ16275) {
    console.log(`  Askman: ${aQ16275.selectedOption}`);
  } else {
    console.log('  Askman: question-16275が見つかりません');
  }
  console.log('');

  // 比較とレポート生成
  console.log('📊 比較レポート生成中...');
  const comparison = comparisonEngine.compare(cResult, aResult);
  const formattedReport = comparisonEngine.formatResult(comparison);
  await reportWriter.saveReport(comparison, formattedReport);
  await reportWriter.saveReportJSON(comparison);
  console.log('✅ レポート生成完了');
  console.log('');

  // 結果サマリー
  if (cQ16275 && aQ16275 && cQ16275.selectedOption === aQ16275.selectedOption) {
    console.log('✅ 成功: question-16275の回答が一致しました！');
  } else if (!cQ16275 && !aQ16275) {
    console.log('⚠️  question-16275が両エンジンで出現しませんでした');
  } else {
    console.log('❌ 失敗: question-16275の回答が異なります');
  }
}

testQuestion16275().catch(console.error);
