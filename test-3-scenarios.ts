import { PlaywrightQARunner } from './src/runners/PlaywrightQARunner';
import { ComparisonEngine } from './src/comparison/ComparisonEngine';
import { ReportWriter } from './src/reporters/ReportWriter';
import { TestScenario } from './src/types';

async function runMultipleScenarios() {
  const scenarios: TestScenario[] = [
    {
      name: '30歳女性・頭痛',
      user: { age: 30, sex: 'female', relationship: 'myself' },
      complaints: [{ id: 'headache', text: '頭痛がする、頭が重い' }],
      answers: [],
    },
    {
      name: '50歳男性・咳',
      user: { age: 50, sex: 'male', relationship: 'myself' },
      complaints: [{ id: 'cough', text: '咳が出る' }],
      answers: [],
    },
    {
      name: '40歳男性・発熱',
      user: { age: 40, sex: 'male', relationship: 'myself' },
      complaints: [{ id: 'fever', text: '熱がある' }],
      answers: [],
    },
  ];

  const baseUrl = 'https://staging.ubie.app';
  const comparisonEngine = new ComparisonEngine();
  const reportWriter = new ReportWriter('./reports');

  console.log('🧪 3シナリオ比較テスト開始\n');
  console.log('━'.repeat(80));
  console.log('📋 実行シナリオ:');
  scenarios.forEach((s, i) => console.log(`   ${i + 1}. ${s.name}`));
  console.log('━'.repeat(80));
  console.log('\n');

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    console.log('='.repeat(80));
    console.log(`📍 [${i + 1}/${scenarios.length}] ${scenario.name}`);
    console.log('='.repeat(80));
    console.log('');

    // C-Diagnosis実行
    console.log('🔵 C-Diagnosis実行中...');
    const cRunner = new PlaywrightQARunner(baseUrl);
    cRunner.setEngine('c-diagnosis');
    cRunner.setRandomSeed(12345);
    await cRunner.init(true);
    const cResult = await cRunner.runScenario(scenario);
    await cRunner.close();
    console.log(`✅ C-Diagnosis完了: ${cResult.questionCount}問, ${cResult.diseases.length}疾患\n`);

    // Askman実行
    console.log('🔴 Askman実行中...');
    const aRunner = new PlaywrightQARunner(baseUrl);
    aRunner.setEngine('askman');
    aRunner.setRandomSeed(12345);
    await aRunner.init(true);
    const aResult = await aRunner.runScenario(scenario);
    await aRunner.close();
    console.log(`✅ Askman完了: ${aResult.questionCount}問, ${aResult.diseases.length}疾患\n`);

    // 比較とレポート生成
    console.log('🔍 比較実行中...');
    const comparison = comparisonEngine.compare(cResult, aResult);
    const formattedReport = comparisonEngine.formatResult(comparison);
    await reportWriter.saveReport(comparison, formattedReport);
    await reportWriter.saveReportJSON(comparison);
    console.log('📝 レポート出力完了\n');

    if (comparison.passed) {
      console.log(`✅ PASSED: ${scenario.name}\n`);
      passed++;
    } else {
      console.log(`❌ FAILED: ${scenario.name}\n`);
      failed++;
      
      // 差分の概要を表示
      if (comparison.differences.resultPageElementsMismatch) {
        console.log('📊 結果画面要素の差分:');
        const elemDiff = comparison.differences.resultPageElementsMismatch;
        
        if (elemDiff.buttons?.ubieActions) {
          console.log(`   ユビー機能ボタン:`);
          console.log(`     - C-Diagnosis: ${elemDiff.buttons.ubieActions.cDiagnosis.length}個`);
          console.log(`     - Askman: ${elemDiff.buttons.ubieActions.askman.length}個`);
        }
        
        if (elemDiff.sections) {
          console.log(`   セクション:`);
          Object.entries(elemDiff.sections).forEach(([key, value]: [string, any]) => {
            const label = key === 'otc' ? '市販薬' : key === 'relatedDiseases' ? '関連疾患' : key;
            console.log(`     - ${label}: C=${value.cDiagnosis ? '✅' : '❌'}, A=${value.askman ? '✅' : '❌'}`);
          });
        }
      }
      console.log('');
    }

    // 次のシナリオまで少し待機
    if (i < scenarios.length - 1) {
      console.log('⏳ 次のシナリオまで3秒待機...\n');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.log('\n');
  console.log('━'.repeat(80));
  console.log('📊 最終結果');
  console.log('━'.repeat(80));
  console.log(`✅ PASSED: ${passed}/${scenarios.length}`);
  console.log(`❌ FAILED: ${failed}/${scenarios.length}`);
  console.log('\n📁 詳細レポート: reports/');
  console.log('━'.repeat(80));
}

runMultipleScenarios().catch(console.error);
