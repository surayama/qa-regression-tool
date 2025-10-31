import { PlaywrightQARunner } from './src/runners/PlaywrightQARunner';
import { ComparisonEngine } from './src/comparison/ComparisonEngine';
import { ReportWriter } from './src/reporters/ReportWriter';
import { TestScenario } from './src/types';

/**
 * 5シナリオで比較テストを実行
 * 結果画面要素の比較機能をテスト
 */
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
      complaints: [{ id: 'cough', text: 'せき・たんが出る、たんに血や泡が混ざる' }],
      answers: [],
    },
    {
      name: '60歳女性・腹痛',
      user: { age: 60, sex: 'female', relationship: 'myself' },
      complaints: [{ id: 'abdominal-pain', text: 'おなかが痛い' }],
      answers: [],
    },
    {
      name: '40歳男性・発熱',
      user: { age: 40, sex: 'male', relationship: 'myself' },
      complaints: [{ id: 'fever', text: '熱がある' }],
      answers: [],
    },
    {
      name: '35歳女性・めまい',
      user: { age: 35, sex: 'female', relationship: 'myself' },
      complaints: [{ id: 'dizziness', text: 'めまいがする' }],
      answers: [],
    },
  ];

  console.log('🧪 5シナリオ比較テスト開始\n');
  console.log('━'.repeat(80));
  console.log('📋 実行シナリオ:');
  scenarios.forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.name}`);
  });
  console.log('━'.repeat(80));
  console.log('');

  const baseUrl = 'https://staging.ubie.app';
  const comparisonEngine = new ComparisonEngine();
  const reportWriter = new ReportWriter();

  let passCount = 0;
  let failCount = 0;

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📍 [${i + 1}/${scenarios.length}] ${scenario.name}`);
    console.log('='.repeat(80));

    try {
      // C-Diagnosis実行
      console.log('\n🔵 C-Diagnosis実行中...');
      const cRunner = new PlaywrightQARunner(baseUrl);
      cRunner.setEngine('c-diagnosis');
      cRunner.setRandomSeed(12345);
      await cRunner.init(true);
      const cResult = await cRunner.runScenario(scenario);
      await cRunner.close();
      console.log(`✅ C-Diagnosis完了: ${cResult.questionCount}問, ${cResult.diseases.length}疾患`);

      // Askman実行
      console.log('\n🟢 Askman実行中...');
      const aRunner = new PlaywrightQARunner(baseUrl);
      aRunner.setEngine('askman');
      aRunner.setRandomSeed(12345);
      await aRunner.init(true);
      const aResult = await aRunner.runScenario(scenario);
      await aRunner.close();
      console.log(`✅ Askman完了: ${aResult.questionCount}問, ${aResult.diseases.length}疾患`);

      // 比較実行
      console.log('\n🔍 比較実行中...');
      const comparison = comparisonEngine.compare(cResult, aResult);

      // レポート出力
      const formattedReport = comparisonEngine.formatResult(comparison);
      await reportWriter.saveReport(comparison, formattedReport);
      await reportWriter.saveReportJSON(comparison);
      console.log(`📝 レポート出力完了`);

      if (comparison.passed) {
        passCount++;
        console.log(`\n✅ PASSED: ${scenario.name}`);
      } else {
        failCount++;
        console.log(`\n❌ FAILED: ${scenario.name}`);
      }

      // 要素差分の概要を表示
      const elementsMismatch = (comparison.differences as any).resultPageElementsMismatch;
      if (elementsMismatch) {
        console.log('\n📊 結果画面要素の差分:');

        if (elementsMismatch.banners) {
          console.log('   バナー:');
          if (elementsMismatch.banners.membershipPlus) {
            console.log(`     - 会員登録: C=${elementsMismatch.banners.membershipPlus.cDiagnosis ? '✅' : '❌'}, A=${elementsMismatch.banners.membershipPlus.askman ? '✅' : '❌'}`);
          }
          if (elementsMismatch.banners.appDownload) {
            console.log(`     - アプリDL: C=${elementsMismatch.banners.appDownload.cDiagnosis ? '✅' : '❌'}, A=${elementsMismatch.banners.appDownload.askman ? '✅' : '❌'}`);
          }
        }

        if (elementsMismatch.buttons?.ubieActions) {
          console.log('   ユビー機能ボタン:');
          console.log(`     - C-Diagnosis: ${elementsMismatch.buttons.ubieActions.cDiagnosis.length}個`);
          console.log(`     - Askman: ${elementsMismatch.buttons.ubieActions.askman.length}個`);
        }

        if (elementsMismatch.sections?.otc) {
          console.log('   セクション:');
          console.log(`     - 市販薬: C=${elementsMismatch.sections.otc.cDiagnosis ? '✅' : '❌'}, A=${elementsMismatch.sections.otc.askman ? '✅' : '❌'}`);
        }
      } else {
        console.log('\n📊 結果画面要素: 差分なし');
      }

    } catch (error) {
      failCount++;
      console.log(`\n❌ ERROR: ${scenario.name}`);
      console.error(error);
    }

    // 次のシナリオまで少し待機
    if (i < scenarios.length - 1) {
      console.log('\n⏳ 次のシナリオまで3秒待機...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // 最終サマリー
  console.log('\n\n');
  console.log('━'.repeat(80));
  console.log('📊 最終結果');
  console.log('━'.repeat(80));
  console.log(`✅ PASSED: ${passCount}/${scenarios.length}`);
  console.log(`❌ FAILED: ${failCount}/${scenarios.length}`);
  console.log('');
  console.log(`📁 詳細レポート: reports/`);
  console.log('━'.repeat(80));
}

runMultipleScenarios().catch(console.error);
