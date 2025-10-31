import { PlaywrightQARunner } from './src/runners/PlaywrightQARunner';
import { ComparisonEngine } from './src/comparison/ComparisonEngine';
import { TestScenario } from './src/types';
import * as fs from 'fs';

/**
 * 複数シナリオで要素の出現パターンを確認
 */
async function testMultipleScenarios() {
  const scenarios: TestScenario[] = [
    {
      name: '30歳女性・頭痛',
      user: { age: 30, sex: 'female', relationship: 'myself' },
      complaints: [{ id: 'headache', text: '頭痛がする・頭が重い' }],
      answers: [],
    },
    {
      name: '50歳男性・咳',
      user: { age: 50, sex: 'male', relationship: 'myself' },
      complaints: [{ id: 'cough', text: 'せき・たんが出る、たんに血や泡が混ざる' }],
      answers: [],
    },
    {
      name: '60歳女性・腹痛',
      user: { age: 60, sex: 'female', relationship: 'myself' },
      complaints: [{ id: 'abdominal-pain', text: 'お腹が痛い' }],
      answers: [],
    },
  ];

  const randomSeed = 12345;
  const results: any[] = [];

  console.log('🧪 複数シナリオで要素検出パターンを確認\n');

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📍 シナリオ ${i + 1}/${scenarios.length}: ${scenario.name}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // C-Diagnosis
    const cRunner = new PlaywrightQARunner('https://staging.ubie.app');
    cRunner.setEngine('c-diagnosis');
    cRunner.setRandomSeed(randomSeed);
    await cRunner.init(true);

    const cResult = await cRunner.runScenario(scenario);
    await cRunner.close();

    console.log(`✅ C-Diagnosis: ${cResult.questionCount}問, ${cResult.diseases.length}疾患\n`);

    // 結果を保存
    const elements = cResult.resultPageElements;
    if (elements) {
      results.push({
        scenario: scenario.name,
        elements: {
          banners: elements.banners,
          buttons: elements.buttons,
          sections: elements.sections,
        },
      });

      // 詳細表示
      console.log('📊 検出された要素:');
      console.log(`   バナー:`);
      console.log(`     - 会員登録: ${elements.banners?.membershipPlus ? '✅' : '❌'}`);
      console.log(`     - アプリDL: ${elements.banners?.appDownload ? '✅' : '❌'}`);
      console.log(`     - 広告: ${elements.banners?.ads?.length || 0}個`);
      console.log(`   ボタン:`);
      console.log(`     - 病院検索: ${elements.buttons?.hospitalSearch ? '✅' : '❌'}`);
      console.log(`     - ユビー機能: ${elements.buttons?.ubieActions?.length || 0}個`);
      console.log(`   セクション:`);
      console.log(`     - 市販薬: ${elements.sections?.otc ? '✅' : '❌'}`);
      console.log(`     - 関連疾患: ${elements.sections?.relatedDiseases ? '✅' : '❌'}`);
      console.log(`     - 治療情報: ${elements.sections?.treatmentInfo ? '✅' : '❌'}`);
      console.log('');
    }
  }

  // 結果をJSONに保存
  fs.writeFileSync('element-patterns.json', JSON.stringify(results, null, 2));

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📄 要素パターンを保存: element-patterns.json');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // パターン分析
  console.log('📊 パターン分析:\n');

  const allMembershipPlus = results.every(r => r.elements.banners?.membershipPlus);
  const allAppDownload = results.every(r => r.elements.banners?.appDownload);
  const allHospitalSearch = results.every(r => r.elements.buttons?.hospitalSearch);
  const anyOtc = results.some(r => r.elements.sections?.otc);
  const allRelatedDiseases = results.every(r => r.elements.sections?.relatedDiseases);

  console.log(`会員登録バナー: ${allMembershipPlus ? '全シナリオで表示 (固定)' : '一部シナリオのみ (動的)'}`);
  console.log(`アプリDLバナー: ${allAppDownload ? '全シナリオで表示 (固定)' : '一部シナリオのみ (動的)'}`);
  console.log(`病院検索ボタン: ${allHospitalSearch ? '全シナリオで表示 (固定)' : '一部シナリオのみ (動的)'}`);
  console.log(`市販薬セクション: ${anyOtc ? '一部シナリオで表示 (動的)' : '全シナリオで非表示'}`);
  console.log(`関連疾患セクション: ${allRelatedDiseases ? '全シナリオで表示 (固定)' : '一部シナリオのみ (動的)'}`);

  const ubieActionsCount = results.map(r => r.elements.buttons?.ubieActions?.length || 0);
  const uniqueCounts = [...new Set(ubieActionsCount)];
  console.log(`ユビー機能ボタン: ${uniqueCounts.length === 1 ? `常に${uniqueCounts[0]}個 (固定)` : `${Math.min(...ubieActionsCount)}-${Math.max(...ubieActionsCount)}個 (動的)`}`);
}

testMultipleScenarios().catch(console.error);
