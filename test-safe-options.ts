import { PlaywrightQARunner } from './src/runners/PlaywrightQARunner';
import { TestScenario } from './src/types';

const runner = new PlaywrightQARunner();

// �����g����k
runner.setRandomSeed(12345);

const scenario: TestScenario = {
  name: '20s7'�-�LY�',
  user: {
    age: 20,
    sex: 'male',
    relationship: 'myself',
  },
  complaints: [
    { id: 'headache', text: '-�LY�-L�D' },
  ],
  answers: [],
};

async function main() {
  console.log('\n>� �hjx��*Hƹ�\n');
  console.log('='.repeat(100));

  // c-diagnosis
  await runner.init();
  runner.setEngine('c-diagnosis');
  console.log('\n=5 C-Diagnosis�L-...');
  const cResult = await runner.runScenario(scenario);
  console.log(` C-Diagnosis��: ${cResult.questionCount}O, ${cResult.diseases.length}��`);

  // askman
  await runner.init();
  runner.setEngine('askman');
  console.log('\n=4 Askman�L-...');
  const aResult = await runner.runScenario(scenario);
  console.log(` Askman��: ${aResult.questionCount}O, ${aResult.diseases.length}��`);

  await runner.close();

  // Q26n�T��
  console.log('\n');
  console.log('=� �Ophx��n�');
  console.log('\n');
  console.log(`�Op: c-diagnosis=${cResult.questionCount}O, askman=${aResult.questionCount}O\n`);

  // question-16275��Y
  const cQ16275 = cResult.questionLogs?.find(q => q.url.includes('question-16275'));
  const aQ16275 = aResult.questionLogs?.find(q => q.url.includes('question-16275'));

  if (cQ16275 && aQ16275) {
    console.log('question-16275 n�T�:\n');
    console.log(`[c-diagnosis]`);
    console.log(`  �O: ${cQ16275.questionText}`);
    console.log(`  �T: ${cQ16275.selectedOption}\n`);
    console.log(`[askman]`);
    console.log(`  �O: ${aQ16275.questionText}`);
    console.log(`  �T: ${aQ16275.selectedOption}\n`);

    if (cQ16275.selectedOption === aQ16275.selectedOption) {
      console.log(' X�TLxp�~W_!');
    } else {
      console.log('L pj��TLxp�~W_');
    }
  } else {
    console.log('�  question-16275L�dK�~[�gW_');
  }

  console.log('\n' + '='.repeat(100) + '\n');
}

main().catch(console.error);
