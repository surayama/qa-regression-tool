import { PlaywrightQARunner } from './src/runners/PlaywrightQARunner';
import { TestScenario } from './src/types';

async function testCough() {
  const scenario: TestScenario = {
    name: '50歳男性・咳',
    user: { age: 50, sex: 'male', relationship: 'myself' },
    complaints: [{ id: 'cough', text: '咳が出る' }],
    answers: [],
  };

  const runner = new PlaywrightQARunner('https://staging.ubie.app');
  runner.setEngine('askman');
  runner.setRandomSeed(12345);
  
  console.log('🔴 Askman実行中（咳）...');
  await runner.init(true);
  
  try {
    const result = await runner.runScenario(scenario);
    console.log(`✅ 完了: ${result.questionCount}問`);
  } catch (error: any) {
    console.log(`❌ エラー: ${error.message}`);
  } finally {
    await runner.close();
  }
}

testCough().catch(console.error);
