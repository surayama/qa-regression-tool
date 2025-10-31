import { PlaywrightQARunner } from './src/runners/PlaywrightQARunner';
import { ComparisonEngine } from './src/comparison/ComparisonEngine';
import { ReportWriter } from './src/reporters/ReportWriter';
import { TestScenario } from './src/types';

async function testSafeOptions() {
  const scenario: TestScenario = {
    name: '20歳男性・頭痛がする',
    user: { age: 20, sex: 'male', relationship: 'myself' },
    complaints: [{ id: 'headache', text: '頭痛がする、頭が重い' }],
    answers: [],
  };

  const baseUrl = 'https://staging.ubie.app';
  const comparisonEngine = new ComparisonEngine();
  const reportWriter = new ReportWriter('./reports');

  console.log('\n🧪 question-16275安全な選択肢優先テスト\n');
  console.log('='.repeat(100) + '\n');

  // C-Diagnosis実行
  console.log('🔵 C-Diagnosis実行中...\n');
  const cRunner = new PlaywrightQARunner(baseUrl);
  cRunner.setEngine('c-diagnosis');
  cRunner.setRandomSeed(12345);
  await cRunner.init(true);
  const cResult = await cRunner.runScenario(scenario);
  await cRunner.close();
  console.log(`✅ C-Diagnosis完了: ${cResult.questionCount}問, ${cResult.diseases.length}疾患\n`);

  // Askman実行
  console.log('🔴 Askman実行中...\n');
  const aRunner = new PlaywrightQARunner(baseUrl);
  aRunner.setEngine('askman');
  aRunner.setRandomSeed(12345);
  await aRunner.init(true);
  const aResult = await aRunner.runScenario(scenario);
  await aRunner.close();
  console.log(`✅ Askman完了: ${aResult.questionCount}問, ${aResult.diseases.length}疾患\n`);

  // 比較とレポート生成（元の形式を使用）
  const comparison = comparisonEngine.compare(cResult, aResult);
  const formattedReport = comparisonEngine.formatResult(comparison);
  await reportWriter.saveReport(comparison, formattedReport);
  await reportWriter.saveReportJSON(comparison);

  // コンソール出力
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 質問数と回答の比較');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`質問数: c-diagnosis=${cResult.questionCount}問, askman=${aResult.questionCount}問\n`);

  // question-16275を探す
  const cQ16275 = cResult.questionLogs?.find(q => q.url.includes('question-16275'));
  const aQ16275 = aResult.questionLogs?.find(q => q.url.includes('question-16275'));

  if (cQ16275 && aQ16275) {
    console.log('question-16275の回答比較:\n');
    console.log(`[c-diagnosis]`);
    console.log(`  質問: ${cQ16275.questionText}`);
    console.log(`  回答: ${cQ16275.selectedOption}\n`);
    console.log(`[askman]`);
    console.log(`  質問: ${aQ16275.questionText}`);
    console.log(`  回答: ${aQ16275.selectedOption}\n`);

    if (cQ16275.selectedOption === aQ16275.selectedOption) {
      console.log('✅ 同じ回答が選ばれました!');
    } else {
      console.log('❌ 異なる回答が選ばれました');
    }
  } else {
    console.log('⚠️  question-16275が見つかりませんでした');
  }

  if (comparison.passed) {
    console.log(`\n✅ PASSED`);
  } else {
    console.log(`\n❌ FAILED`);
  }

  console.log('\n' + '='.repeat(100) + '\n');
  console.log(`📄 レポート保存完了\n`);
}

testSafeOptions().catch(console.error);
