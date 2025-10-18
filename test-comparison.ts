import { PlaywrightQARunner } from './src/runners/PlaywrightQARunner';
import { ComparisonEngine } from './src/comparison/ComparisonEngine';
import { ReportWriter } from './src/reporters/ReportWriter';
import { TestScenario } from './src/types';
import { scenarios } from './scenarios-updated';

async function main() {
  console.log('🚀 両エンジン (c-diagnosis vs askman) をstagingでテスト中...\n');

  // シナリオはscenarios-updated.tsから読み込み
  const oldScenarios: TestScenario[] = [
    // 消化器系
    { name: '30歳男性・腹痛', user: { age: 30, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'abdominal-pain', text: 'お腹が痛い' }], answers: [] },
    { name: '32歳女性・下痢', user: { age: 32, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'diarrhea', text: '下痢' }], answers: [] },
    { name: '28歳女性・吐き気', user: { age: 28, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'nausea', text: '吐き気' }], answers: [] },
    { name: '45歳男性・胃痛', user: { age: 45, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'stomach-pain', text: '胃が痛い' }], answers: [] },
    { name: '38歳女性・便秘', user: { age: 38, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'constipation', text: '便秘' }], answers: [] },

    // 呼吸器系
    { name: '50歳男性・咳', user: { age: 50, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'cough', text: '咳が出る' }], answers: [] },
    { name: '60歳女性・息切れ', user: { age: 60, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'shortness-of-breath', text: '息切れ' }], answers: [] },
    { name: '42歳男性・喉の痛み', user: { age: 42, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'sore-throat', text: '喉が痛い' }], answers: [] },
    { name: '35歳女性・鼻水', user: { age: 35, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'runny-nose', text: '鼻水' }], answers: [] },
    { name: '55歳男性・痰', user: { age: 55, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'phlegm', text: '痰が出る' }], answers: [] },

    // 循環器・胸部
    { name: '45歳男性・胸痛', user: { age: 45, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'chest-pain', text: '胸が痛い' }], answers: [] },
    { name: '58歳女性・動悸', user: { age: 58, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'palpitations', text: '動悸' }], answers: [] },
    { name: '62歳男性・胸の圧迫感', user: { age: 62, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'chest-pressure', text: '胸の圧迫感' }], answers: [] },

    // 神経系
    { name: '25歳女性・頭痛', user: { age: 25, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'headache', text: '頭痛' }], answers: [] },
    { name: '35歳女性・めまい', user: { age: 35, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'dizziness', text: 'めまいがする' }], answers: [] },
    { name: '48歳男性・しびれ', user: { age: 48, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'numbness', text: 'しびれ' }], answers: [] },
    { name: '40歳女性・ふらつき', user: { age: 40, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'unsteadiness', text: 'ふらつき' }], answers: [] },

    // 筋骨格系
    { name: '55歳男性・腰痛', user: { age: 55, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'back-pain', text: '腰が痛い' }], answers: [] },
    { name: '42歳女性・肩こり', user: { age: 42, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'shoulder-stiffness', text: '肩こり' }], answers: [] },
    { name: '52歳男性・膝の痛み', user: { age: 52, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'knee-pain', text: '膝が痛い' }], answers: [] },
    { name: '38歳女性・首の痛み', user: { age: 38, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'neck-pain', text: '首が痛い' }], answers: [] },
    { name: '60歳男性・関節痛', user: { age: 60, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'joint-pain', text: '関節が痛い' }], answers: [] },

    // 全身症状
    { name: '40歳男性・発熱', user: { age: 40, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'fever', text: '発熱' }], answers: [] },
    { name: '33歳女性・倦怠感', user: { age: 33, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'fatigue', text: 'だるい' }], answers: [] },
    { name: '47歳男性・体重減少', user: { age: 47, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'weight-loss', text: '体重が減った' }], answers: [] },
    { name: '30歳女性・むくみ', user: { age: 30, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'swelling', text: 'むくみ' }], answers: [] },

    // 皮膚
    { name: '26歳女性・湿疹', user: { age: 26, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'rash', text: '湿疹' }], answers: [] },
    { name: '44歳男性・かゆみ', user: { age: 44, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'itching', text: 'かゆみ' }], answers: [] },
    { name: '31歳女性・じんましん', user: { age: 31, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'hives', text: 'じんましん' }], answers: [] },

    // 泌尿器
    { name: '50歳男性・頻尿', user: { age: 50, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'frequent-urination', text: '頻尿' }], answers: [] },
    { name: '36歳女性・排尿時痛', user: { age: 36, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'painful-urination', text: '排尿時の痛み' }], answers: [] },

    // 耳鼻咽喉
    { name: '39歳男性・耳鳴り', user: { age: 39, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'tinnitus', text: '耳鳴り' }], answers: [] },
    { name: '27歳女性・鼻づまり', user: { age: 27, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'nasal-congestion', text: '鼻づまり' }], answers: [] },

    // 眼科
    { name: '43歳男性・目の痛み', user: { age: 43, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'eye-pain', text: '目が痛い' }], answers: [] },
    { name: '52歳女性・視力低下', user: { age: 52, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'blurred-vision', text: '視力が落ちた' }], answers: [] },

    // メンタル
    { name: '34歳女性・不眠', user: { age: 34, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'insomnia', text: '眠れない' }], answers: [] },
    { name: '41歳男性・不安', user: { age: 41, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'anxiety', text: '不安' }], answers: [] },

    // 婦人科
    { name: '30歳女性・生理痛', user: { age: 30, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'menstrual-pain', text: '生理痛' }], answers: [] },
    { name: '46歳女性・不正出血', user: { age: 46, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'abnormal-bleeding', text: '不正出血' }], answers: [] },

    // 追加シナリオ（多様な主訴）
    { name: '55歳男性・血尿', user: { age: 55, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'hematuria', text: '血尿' }], answers: [] },
    { name: '38歳女性・不妊', user: { age: 38, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'infertility', text: '不妊' }], answers: [] },
    { name: '65歳男性・物忘れ', user: { age: 65, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'memory-loss', text: '物忘れ' }], answers: [] },
    { name: '22歳女性・過呼吸', user: { age: 22, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'hyperventilation', text: '過呼吸' }], answers: [] },
    { name: '48歳男性・血便', user: { age: 48, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'bloody-stool', text: '血便' }], answers: [] },
    { name: '32歳女性・脱毛', user: { age: 32, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'hair-loss', text: '脱毛' }], answers: [] },
    { name: '70歳男性・嚥下困難', user: { age: 70, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'dysphagia', text: '嚥下困難' }], answers: [] },
    { name: '26歳女性・ほてり', user: { age: 26, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'hot-flash', text: 'ほてり' }], answers: [] },
    { name: '58歳男性・黄疸', user: { age: 58, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'jaundice', text: '黄疸' }], answers: [] },
    { name: '8歳男児・腹痛', user: { age: 8, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'abdominal-pain-child', text: 'お腹が痛い' }], answers: [] },
  ];

  // デバッグ時はfalseに設定してブラウザウィンドウを表示
  const headless = true;

  // ランダムモード:
  // - シナリオごとに異なるシード値を生成（シナリオインデックスベース）
  // - 同じシナリオではc-diagnosisとaskmanで同じシード値を使用して回答パターンを一致させる
  // - nullに設定すると「回答をとばす」動作になる
  const baseRandomSeed = 12345; // ベースシード値

  // 全シナリオを実行
  const testScenarios = scenarios; // 全シナリオ実行

  console.log(`📊 合計 ${testScenarios.length} 個のシナリオを順次実行します`);
  console.log(`🎲 シナリオごとに異なるランダムパターンで実行します\n`);

  let completedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < testScenarios.length; i++) {
    const scenario = testScenarios[i];

    // シナリオごとに異なるシード値を生成
    const randomSeed = baseRandomSeed + i * 1000;

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🧪 シナリオ ${i + 1}/${testScenarios.length}: ${scenario.name}`);
    console.log(`   ユーザー: ${scenario.user.age}歳 ${scenario.user.sex === 'male' ? '男性' : '女性'}`);
    console.log(`   🎲 ランダムシード: ${randomSeed}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
      // 両エンジンのランナーを初期化（同じシード値を使用）
      const cRunner = new PlaywrightQARunner('https://staging.ubie.app');
      cRunner.setEngine('c-diagnosis');
      cRunner.setRandomSeed(randomSeed);

      const aRunner = new PlaywrightQARunner('https://staging.ubie.app');
      aRunner.setEngine('askman');
      aRunner.setRandomSeed(randomSeed);

      await Promise.all([cRunner.init(headless), aRunner.init(headless)]);
      console.log('✅ ブラウザを初期化しました\n');

      // 両エンジンを同じランダムシードで並列実行
      console.log('⚡ 両エンジンを並列実行中...\n');

      console.log('📍 C-Diagnosisエンジン: 開始...');
      console.log('📍 Askmanエンジン: 開始...');
      const [cResult, aResult] = await Promise.all([
        cRunner.runScenario(scenario),
        aRunner.runScenario(scenario),
      ]);

      console.log(`📍 C-Diagnosisエンジン: ✓ 完了 ${(cResult.executionTimeMs / 1000).toFixed(1)}秒`);
      console.log(`   ✓ ${cResult.questionCount}個の質問に回答`);
      console.log(`   ✓ ${cResult.diseases.length}個の疾患を発見\n`);

      console.log(`📍 Askmanエンジン: ✓ 完了 ${(aResult.executionTimeMs / 1000).toFixed(1)}秒`);
      console.log(`   ✓ ${aResult.questionCount}個の質問に回答`);
      console.log(`   ✓ ${aResult.diseases.length}個の疾患を発見\n`);

      // 結果を比較
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔍 比較結果:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      const comparisonEngine = new ComparisonEngine();
      const comparison = comparisonEngine.compare(cResult, aResult);
      const formattedReport = comparisonEngine.formatResult(comparison);

      console.log(formattedReport);

      // レポートをファイルに保存
      const reportWriter = new ReportWriter();
      const txtPath = await reportWriter.saveReport(comparison, formattedReport);
      const jsonPath = await reportWriter.saveReportJSON(comparison);

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('💾 レポート保存完了:');
      console.log(`   📄 テキストレポート: ${txtPath}`);
      console.log(`   📊 JSONレポート: ${jsonPath}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      await Promise.all([cRunner.close(), aRunner.close()]);
      console.log('\n✅ ブラウザを閉じました');

      completedCount++;
      console.log(`\n✅ シナリオ ${i + 1}/${testScenarios.length} 完了 (成功: ${completedCount}, 失敗: ${failedCount})\n`);
    } catch (error) {
      failedCount++;
      console.error(`\n❌ シナリオ ${i + 1}/${testScenarios.length} 失敗:`, error);
      console.log(`\n⚠️  進捗: (成功: ${completedCount}, 失敗: ${failedCount})\n`);
    }
  }

  // 最終サマリー
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 全テスト完了');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 成功: ${completedCount}/${testScenarios.length}`);
  console.log(`❌ 失敗: ${failedCount}/${testScenarios.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);
