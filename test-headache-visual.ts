import { PlaywrightQARunner } from './src/runners/PlaywrightQARunner';
import { TestScenario } from './src/types';

async function testHeadacheVisual() {
  const scenario: TestScenario = {
    name: '30歳女性・頭痛（目視確認）',
    user: { age: 30, sex: 'female', relationship: 'myself' },
    complaints: [{ id: 'headache', text: '頭痛がする、頭が重い' }],
    answers: [],
  };

  const runner = new PlaywrightQARunner('https://staging.ubie.app');
  runner.setEngine('c-diagnosis');
  runner.setRandomSeed(12345);
  
  console.log('🔵 C-Diagnosis実行中（ブラウザ表示）...\n');
  console.log('⚠️  ブラウザを開いたままにします。question-16275が出たら一時停止します。\n');
  
  // ブラウザを表示したまま実行（headless: false）
  await runner.init(false); // false = ブラウザを表示
  
  try {
    const result = await runner.runScenario(scenario, true); // keepPageOpen = true
    console.log(`\n✅ 完了: ${result.questionCount}問, ${result.diseases.length}疾患\n`);
    
    // question-16275の情報を表示
    const q16275 = result.questionLogs?.find(log => log.url.includes('question-16275'));
    if (q16275) {
      console.log(`\n✅✅✅ question-16275が出ました！✅✅✅`);
      console.log(`   質問番号: Q${q16275.questionNumber}`);
      console.log(`   質問文: ${q16275.questionText}`);
      console.log(`   選択した回答: ${q16275.selectedOption}\n`);
    }
    
    console.log('\n⏸️  ブラウザを開いたままにしています。');
    console.log('   結果ページを確認できます。');
    console.log('   確認が終わったらEnterキーを押してください...\n');
    
    // ユーザーの入力待ち（ブラウザを開いたまま）
    await new Promise((resolve) => {
      process.stdin.once('data', resolve);
    });
    
  } catch (error: any) {
    console.log(`❌ エラー: ${error.message}`);
    console.log('\nEnterキーを押して終了してください...');
    await new Promise((resolve) => {
      process.stdin.once('data', resolve);
    });
  }
  
  console.log('\n👋 ブラウザを閉じます...');
}

testHeadacheVisual().catch(console.error);
