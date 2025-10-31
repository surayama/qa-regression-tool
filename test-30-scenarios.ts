import { PlaywrightQARunner } from './src/runners/PlaywrightQARunner';
import { ComparisonEngine } from './src/comparison/ComparisonEngine';
import { ReportWriter } from './src/reporters/ReportWriter';
import { TestScenario } from './src/types';

async function runMultipleScenarios() {
  // 30個の多様なシナリオを生成
  const symptoms = [
    { id: 'headache', text: '頭痛がする、頭が重い' },
    { id: 'cough', text: '咳が出る' },
    { id: 'fever', text: '熱がある' },
    { id: 'abdominal-pain', text: 'お腹が痛い' },
    { id: 'dizziness', text: 'めまいがする' },
    { id: 'nausea', text: '吐き気がする、嘔吐した' },
    { id: 'diarrhea', text: '下痢をしている' },
    { id: 'fatigue', text: '体がだるい' },
    { id: 'sore-throat', text: '喉が痛い' },
    { id: 'chest-pain', text: '胸が痛い' },
  ];

  const ages = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65];
  const sexes: ('male' | 'female')[] = ['male', 'female'];

  const scenarios: TestScenario[] = [];
  for (let i = 0; i < 30; i++) {
    const symptom = symptoms[i % symptoms.length];
    const age = ages[Math.floor(i / 3) % ages.length];
    const sex = sexes[i % 2];
    const sexText = sex === 'male' ? '男性' : '女性';

    scenarios.push({
      name: `${age}歳${sexText}・${symptom.text.split('、')[0]}`,
      user: { age, sex, relationship: 'myself' },
      complaints: [{ id: symptom.id, text: symptom.text }],
      answers: [],
    });
  }

  const baseUrl = 'https://staging.ubie.app';
  const comparisonEngine = new ComparisonEngine();
  const reportWriter = new ReportWriter('./reports');

  console.log('🧪 30シナリオ比較テスト開始\n');
  console.log('━'.repeat(80));
  console.log(`📋 実行シナリオ: ${scenarios.length}個`);
  console.log('━'.repeat(80));
  console.log('\n');

  let passed = 0;
  let failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    const scenarioStartTime = Date.now();
    
    console.log('='.repeat(80));
    console.log(`📍 [${i + 1}/${scenarios.length}] ${scenario.name}`);
    console.log('='.repeat(80));

    try {
      // C-Diagnosis実行
      console.log('🔵 C-Diagnosis実行中...');
      const cRunner = new PlaywrightQARunner(baseUrl);
      cRunner.setEngine('c-diagnosis');
      cRunner.setRandomSeed(12345 + i); // シナリオごとに異なるseedを使用
      await cRunner.init(true);
      const cResult = await cRunner.runScenario(scenario);
      await cRunner.close();
      console.log(`✅ C-Diagnosis完了: ${cResult.questionCount}問, ${cResult.diseases.length}疾患`);

      // Askman実行
      console.log('🔴 Askman実行中...');
      const aRunner = new PlaywrightQARunner(baseUrl);
      aRunner.setEngine('askman');
      aRunner.setRandomSeed(12345 + i);
      await aRunner.init(true);
      const aResult = await aRunner.runScenario(scenario);
      await aRunner.close();
      console.log(`✅ Askman完了: ${aResult.questionCount}問, ${aResult.diseases.length}疾患`);

      // 比較とレポート生成
      const comparison = comparisonEngine.compare(cResult, aResult);
      const formattedReport = comparisonEngine.formatResult(comparison);
      await reportWriter.saveReport(comparison, formattedReport);
      await reportWriter.saveReportJSON(comparison);

      if (comparison.passed) {
        console.log(`✅ PASSED`);
        passed++;
      } else {
        console.log(`❌ FAILED`);
        failed++;
      }

      const scenarioTime = ((Date.now() - scenarioStartTime) / 1000).toFixed(1);
      console.log(`⏱️  所要時間: ${scenarioTime}秒\n`);

    } catch (error) {
      console.log(`❌ ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
      failed++;
    }

    // 進捗表示
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    const avgTimePerScenario = (Date.now() - startTime) / (i + 1) / 1000;
    const remainingScenarios = scenarios.length - (i + 1);
    const estimatedRemaining = (remainingScenarios * avgTimePerScenario / 60).toFixed(1);
    
    console.log(`📊 進捗: ${i + 1}/${scenarios.length} (✅${passed} ❌${failed}) | 経過時間: ${elapsed}分 | 残り推定: ${estimatedRemaining}分\n`);

    // 次のシナリオまで少し待機（サーバー負荷軽減）
    if (i < scenarios.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('\n');
  console.log('━'.repeat(80));
  console.log('📊 最終結果');
  console.log('━'.repeat(80));
  console.log(`✅ PASSED: ${passed}/${scenarios.length} (${((passed / scenarios.length) * 100).toFixed(1)}%)`);
  console.log(`❌ FAILED: ${failed}/${scenarios.length} (${((failed / scenarios.length) * 100).toFixed(1)}%)`);
  console.log(`⏱️  総実行時間: ${totalTime}分`);
  console.log('\n📁 詳細レポート: reports/');
  console.log('━'.repeat(80));
}

runMultipleScenarios().catch(console.error);
