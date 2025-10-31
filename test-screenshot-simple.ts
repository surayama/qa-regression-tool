import { PlaywrightQARunner } from './src/runners/PlaywrightQARunner';
import { TestScenario } from './src/types';

async function test() {
  const scenario: TestScenario = {
    name: '25歳男性・頭痛',
    user: { age: 25, sex: 'male', relationship: 'myself' },
    complaints: [{ id: 'headache', text: '頭痛がする' }],
    answers: [],
  };

  const runner = new PlaywrightQARunner('https://staging.ubie.app');
  runner.setEngine('c-diagnosis');
  runner.setRandomSeed(12345);

  console.log('Running test...');
  const result = await runner.run(scenario);

  console.log('\nScreenshot path:', result.screenshotPath);
  console.log('Questions:', result.questionCount);
  console.log('Diseases:', result.diseases.length);
}

test().catch(console.error);
