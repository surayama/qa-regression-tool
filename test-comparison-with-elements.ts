import { ComparisonEngine } from './src/comparison/ComparisonEngine';
import { PlaywrightQARunner } from './src/runners/PlaywrightQARunner';
import { TestScenario } from './src/types';

/**
 * c-diagnosis と askman の結果画面要素比較テスト
 * 固定要素は比較対象外、動的要素のみ比較する
 */
async function testComparison() {
  const scenario: TestScenario = {
    name: '50歳男性・咳',
    user: { age: 50, sex: 'male', relationship: 'myself' },
    complaints: [{ id: 'cough', text: 'せき・たんが出る、たんに血や泡が混ざる' }],
    answers: [],
  };

  const randomSeed = 12345;

  console.log('🧪 C-Diagnosis vs Askman 結果画面要素比較テスト\n');
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📍 シナリオ: ${scenario.name}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // C-Diagnosis
  console.log('🔵 C-Diagnosis実行中...');
  const cRunner = new PlaywrightQARunner('https://staging.ubie.app');
  cRunner.setEngine('c-diagnosis');
  cRunner.setRandomSeed(randomSeed);
  await cRunner.init(true);

  const cResult = await cRunner.runScenario(scenario);
  await cRunner.close();

  console.log(`✅ C-Diagnosis完了: ${cResult.questionCount}問, ${cResult.diseases.length}疾患\n`);

  // Askman
  console.log('🟢 Askman実行中...');
  const aRunner = new PlaywrightQARunner('https://staging.ubie.app');
  aRunner.setEngine('askman');
  aRunner.setRandomSeed(randomSeed);
  await aRunner.init(true);

  const aResult = await aRunner.runScenario(scenario);
  await aRunner.close();

  console.log(`✅ Askman完了: ${aResult.questionCount}問, ${aResult.diseases.length}疾患\n`);

  // 比較実行
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 比較実行中...\n');

  const engine = new ComparisonEngine();
  const comparison = engine.compare(cResult, aResult);

  // 詳細表示
  console.log('📊 C-Diagnosis 結果画面要素:');
  const cElements = cResult.resultPageElements;
  if (cElements) {
    console.log(`   バナー:`);
    console.log(`     - 会員登録: ${cElements.banners?.membershipPlus ? '✅' : '❌'}`);
    console.log(`     - アプリDL: ${cElements.banners?.appDownload ? '✅' : '❌'}`);
    console.log(`     - 広告: ${cElements.banners?.ads?.length || 0}個`);
    console.log(`   ボタン:`);
    console.log(`     - 病院検索: ${cElements.buttons?.hospitalSearch ? '✅' : '❌'} (固定)`);
    console.log(`     - ユビー機能: ${cElements.buttons?.ubieActions?.length || 0}個`);
    if (cElements.buttons?.ubieActions && cElements.buttons.ubieActions.length > 0) {
      console.log(`       ${cElements.buttons.ubieActions.join(', ')}`);
    }
    console.log(`   セクション:`);
    console.log(`     - 市販薬: ${cElements.sections?.otc ? '✅' : '❌'}`);
    console.log(`     - 関連疾患: ${cElements.sections?.relatedDiseases ? '✅' : '❌'} (固定)`);
    console.log(`     - 治療情報: ${cElements.sections?.treatmentInfo ? '✅' : '❌'} (固定)`);
  }
  console.log('');

  console.log('📊 Askman 結果画面要素:');
  const aElements = aResult.resultPageElements;
  if (aElements) {
    console.log(`   バナー:`);
    console.log(`     - 会員登録: ${aElements.banners?.membershipPlus ? '✅' : '❌'}`);
    console.log(`     - アプリDL: ${aElements.banners?.appDownload ? '✅' : '❌'}`);
    console.log(`     - 広告: ${aElements.banners?.ads?.length || 0}個`);
    console.log(`   ボタン:`);
    console.log(`     - 病院検索: ${aElements.buttons?.hospitalSearch ? '✅' : '❌'} (固定)`);
    console.log(`     - ユビー機能: ${aElements.buttons?.ubieActions?.length || 0}個`);
    if (aElements.buttons?.ubieActions && aElements.buttons.ubieActions.length > 0) {
      console.log(`       ${aElements.buttons.ubieActions.join(', ')}`);
    }
    console.log(`   セクション:`);
    console.log(`     - 市販薬: ${aElements.sections?.otc ? '✅' : '❌'}`);
    console.log(`     - 関連疾患: ${aElements.sections?.relatedDiseases ? '✅' : '❌'} (固定)`);
    console.log(`     - 治療情報: ${aElements.sections?.treatmentInfo ? '✅' : '❌'} (固定)`);
  }
  console.log('');

  // 比較結果
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 比較結果:\n');
  console.log(engine.formatResult(comparison));

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✨ テスト完了');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📝 比較対象の動的要素:');
  console.log('  ✅ 会員登録バナー');
  console.log('  ✅ アプリDLバナー');
  console.log('  ✅ 広告バナー');
  console.log('  ✅ ユビー機能ボタン');
  console.log('  ✅ 市販薬セクション\n');

  console.log('📝 比較対象外の固定要素:');
  console.log('  ❌ 病院検索ボタン (常に表示)');
  console.log('  ❌ 関連疾患セクション (常に表示)');
  console.log('  ❌ 治療情報セクション (常に表示)');
  console.log('  ❌ SNS共有 (常に表示)');
}

testComparison().catch(console.error);
