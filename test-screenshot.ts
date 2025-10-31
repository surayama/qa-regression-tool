import { ComparisonEngine } from './src/comparison/ComparisonEngine';
import { TestScenario } from './src/types';

async function test() {
  const scenario: TestScenario = {
    name: '25歳男性・頭痛',
    user: { age: 25, sex: 'male', relationship: 'myself' },
    complaints: [{ id: 'headache', text: '頭痛がする' }],
    answers: [],
  };

  const engine = new ComparisonEngine('https://staging.ubie.app', 12345);
  const result = await engine.compare(scenario);

  console.log('C-Diagnosis screenshot:', result.cDiagnosisResult.screenshotPath);
  console.log('Askman screenshot:', result.askmanResult.screenshotPath);
}

test().catch(console.error);
