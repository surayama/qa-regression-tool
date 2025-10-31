import { PlaywrightQARunner } from './src/runners/PlaywrightQARunner';
import { TestScenario } from './src/types';

async function debugQuestion16275() {
  const scenario: TestScenario = {
    name: '20歳男性・頭痛がする',
    user: { age: 20, sex: 'male', relationship: 'myself' },
    complaints: [{ id: 'headache', text: '頭痛がする、頭が重い' }],
    answers: [],
  };

  const runner = new PlaywrightQARunner('https://staging.ubie.app');
  runner.setEngine('c-diagnosis');
  runner.setRandomSeed(12345);

  console.log('\n🔍 question-16275 デバッグテスト（ブラウザ表示）\n');

  // ブラウザを表示して実行
  await runner.init(false);

  try {
    const result = await runner.runScenario(scenario, true);
    console.log(`\n✅ 完了: ${result.questionCount}問\n`);

    const q16275 = result.questionLogs?.find(q => q.url.includes('question-16275'));
    if (q16275) {
      console.log('✅ question-16275が見つかりました');
      console.log(`   質問文: ${q16275.questionText}`);
      console.log(`   選択した回答: ${q16275.selectedOption}`);
    } else {
      console.log('❌ question-16275が見つかりませんでした');
    }

    console.log('\n⏸️  ブラウザを開いたままにしています。Enterキーで終了...\n');
    await new Promise((resolve) => process.stdin.once('data', resolve));

  } catch (error: any) {
    console.log(`❌ エラー: ${error.message}`);
    console.log('\nEnterキーで終了...');
    await new Promise((resolve) => process.stdin.once('data', resolve));
  }

  console.log('\n👋 終了します');
}

debugQuestion16275().catch(console.error);
