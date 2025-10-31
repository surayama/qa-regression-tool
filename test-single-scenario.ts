import { PlaywrightQARunner } from './src/runners/PlaywrightQARunner';
import { ComparisonEngine } from './src/comparison/ComparisonEngine';
import { ReportWriter } from './src/reporters/ReportWriter';
import { TestScenario } from './src/types';

async function testSingleScenario() {
  console.log('🧪 単一シナリオテスト: 新規要素の検出確認\n');

  const scenario: TestScenario = {
    name: '50歳男性・咳',
    user: { age: 50, sex: 'male', relationship: 'myself' },
    complaints: [{ id: 'cough', text: 'せき・たんが出る、たんに血や泡が混ざる' }],
    answers: [],
  };

  const randomSeed = 12345;

  // C-Diagnosis
  console.log('📍 C-Diagnosisエンジン: 開始...');
  const cRunner = new PlaywrightQARunner('https://staging.ubie.app');
  cRunner.setEngine('c-diagnosis');
  cRunner.setRandomSeed(randomSeed);
  await cRunner.init(true); // headless

  const cResult = await cRunner.runScenario(scenario);
  await cRunner.close();

  console.log(`✅ C-Diagnosis完了: ${cResult.questionCount}問, ${cResult.diseases.length}疾患\n`);

  // Askman
  console.log('📍 Askmanエンジン: 開始...');
  const aRunner = new PlaywrightQARunner('https://staging.ubie.app');
  aRunner.setEngine('askman');
  aRunner.setRandomSeed(randomSeed);
  await aRunner.init(true); // headless

  const aResult = await aRunner.runScenario(scenario);
  await aRunner.close();

  console.log(`✅ Askman完了: ${aResult.questionCount}問, ${aResult.diseases.length}疾患\n`);

  // 比較
  const comparison = new ComparisonEngine();
  const result = comparison.compare(cResult, aResult);

  // レポート出力
  const formattedReport = comparison.formatResult(result);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 比較結果');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(formattedReport);

  // ファイル保存
  const reporter = new ReportWriter();
  const txtPath = await reporter.saveReport(result, formattedReport);
  const jsonPath = await reporter.saveReportJSON(result);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💾 レポート保存完了');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📄 テキスト: ${txtPath}`);
  console.log(`📄 JSON: ${jsonPath}`);
}

testSingleScenario().catch(console.error);
