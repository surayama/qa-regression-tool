import { PlaywrightQARunner } from './src/runners/PlaywrightQARunner';
import { TestScenario } from './src/types';

async function testHeadache() {
  const scenario: TestScenario = {
    name: '30歳女性・頭痛（デバッグ）',
    user: { age: 30, sex: 'female', relationship: 'myself' },
    complaints: [{ id: 'headache', text: '頭痛がする、頭が重い' }],
    answers: [],
  };

  const runner = new PlaywrightQARunner('https://staging.ubie.app');
  runner.setEngine('c-diagnosis');
  runner.setRandomSeed(12345);
  
  console.log('🔵 C-Diagnosis実行中（頭痛シナリオ - question-16275確認）...\n');
  await runner.init(true);
  
  try {
    const result = await runner.runScenario(scenario);
    console.log(`\n✅ 完了: ${result.questionCount}問, ${result.diseases.length}疾患\n`);
    
    // question-16275が含まれているか確認
    const has16275 = result.questionLogs?.some(log => log.url.includes('question-16275'));
    console.log(`📋 question-16275の有無: ${has16275 ? '✅ あり' : '❌ なし'}\n`);
    
    if (has16275) {
      const q16275 = result.questionLogs?.find(log => log.url.includes('question-16275'));
      console.log(`📝 question-16275の内容:`);
      console.log(`   URL: ${q16275?.url}`);
      console.log(`   質問: ${q16275?.questionText}`);
      console.log(`   選択肢: ${q16275?.availableOptions.join(', ')}`);
      console.log(`   選択: ${q16275?.selectedOption}\n`);
    } else {
      console.log(`⚠️  question-16275が見つかりませんでした。`);
      console.log(`\n📋 全質問のURL一覧:`);
      result.questionLogs?.forEach((log, i) => {
        console.log(`   Q${i + 1}: ${log.url}`);
      });
    }
  } catch (error: any) {
    console.log(`❌ エラー: ${error.message}`);
  } finally {
    await runner.close();
  }
}

testHeadache().catch(console.error);
