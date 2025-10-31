import { PlaywrightQARunner } from './src/runners/PlaywrightQARunner';

async function testIncognitoFix() {
  console.log('🧪 シークレットモード修正のテスト\n');

  // タバコの質問が出やすいシナリオ（成人男性）
  const scenario = {
    name: '50歳男性・咳テスト',
    user: { age: 50, sex: 'male' as const, relationship: 'myself' as const },
    complaints: [{ id: 'cough', text: 'せき・たんが出る、たんに血や泡が混ざる' }],
    answers: [],
  };

  // c-diagnosisで2回連続実行
  for (let i = 1; i <= 2; i++) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔄 実行 ${i}/2: C-Diagnosis`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    const runner = new PlaywrightQARunner('https://staging.ubie.app');
    runner.setEngine('c-diagnosis');
    runner.setRandomSeed(12345); // 同じシード値

    await runner.init(false); // headless: false でブラウザを表示
    const result = await runner.runScenario(scenario);
    await runner.close();

    console.log(`✅ 完了: ${result.questionCount}個の質問`);

    // 「タバコ」や「喫煙」に関する質問があるか確認
    const tobaccoQuestions = (result.questionLogs || []).filter(log =>
      log.questionText?.includes('タバコ') ||
      log.questionText?.includes('喫煙') ||
      log.questionText?.includes('たばこ')
    );

    if (tobaccoQuestions.length > 0) {
      console.log(`🚬 タバコの質問あり: ${tobaccoQuestions.length}個`);
      tobaccoQuestions.forEach(q => {
        console.log(`   - ${q.questionText}`);
      });
    } else {
      console.log(`⚠️  タバコの質問なし`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 結果: 2回とも同じ質問数なら、修正が効いています');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

testIncognitoFix().catch(console.error);
