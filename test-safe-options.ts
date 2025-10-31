import { PlaywrightQARunner } from './src/runners/PlaywrightQARunner';
import { TestScenario } from './src/types';

const runner = new PlaywrightQARunner();

// ˙ö∑¸…gç˛Ô˝k
runner.setRandomSeed(12345);

const scenario: TestScenario = {
  name: '20s7'˚-€LYã',
  user: {
    age: 20,
    sex: 'male',
    relationship: 'myself',
  },
  complaints: [
    { id: 'headache', text: '-€LYã-LÕD' },
  ],
  answers: [],
};

async function main() {
  console.log('\n>Í âhjxû¢*H∆π»\n');
  console.log('='.repeat(100));

  // c-diagnosis
  await runner.init();
  runner.setEngine('c-diagnosis');
  console.log('\n=5 C-DiagnosisüL-...');
  const cResult = await runner.runScenario(scenario);
  console.log(` C-DiagnosisåÜ: ${cResult.questionCount}O, ${cResult.diseases.length}æ£`);

  // askman
  await runner.init();
  runner.setEngine('askman');
  console.log('\n=4 AskmanüL-...');
  const aResult = await runner.runScenario(scenario);
  console.log(` AskmanåÜ: ${aResult.questionCount}O, ${aResult.diseases.length}æ£`);

  await runner.close();

  // Q26nﬁTí‘
  console.log('\n');
  console.log('=  ÍOphxû¢n‘');
  console.log('\n');
  console.log(`ÍOp: c-diagnosis=${cResult.questionCount}O, askman=${aResult.questionCount}O\n`);

  // question-16275í¢Y
  const cQ16275 = cResult.questionLogs?.find(q => q.url.includes('question-16275'));
  const aQ16275 = aResult.questionLogs?.find(q => q.url.includes('question-16275'));

  if (cQ16275 && aQ16275) {
    console.log('question-16275 nﬁT‘:\n');
    console.log(`[c-diagnosis]`);
    console.log(`  ÍO: ${cQ16275.questionText}`);
    console.log(`  ﬁT: ${cQ16275.selectedOption}\n`);
    console.log(`[askman]`);
    console.log(`  ÍO: ${aQ16275.questionText}`);
    console.log(`  ﬁT: ${aQ16275.selectedOption}\n`);

    if (cQ16275.selectedOption === aQ16275.selectedOption) {
      console.log(' XﬁTLxpå~W_!');
    } else {
      console.log('L pjãﬁTLxpå~W_');
    }
  } else {
    console.log('†  question-16275LãdKä~[ìgW_');
  }

  console.log('\n' + '='.repeat(100) + '\n');
}

main().catch(console.error);
