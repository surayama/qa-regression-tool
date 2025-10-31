import { PlaywrightQARunner } from './src/runners/PlaywrightQARunner';
import { chromium } from 'playwright';
import * as fs from 'fs';

async function analyzeResultPage() {
  console.log('🔍 結果画面の構造を調査中...\n');

  // 簡単なシナリオで結果画面まで到達
  const scenario = {
    name: '50歳男性・咳',
    user: { age: 50, sex: 'male' as const, relationship: 'myself' as const },
    complaints: [{ id: 'cough', text: 'せき・たんが出る、たんに血や泡が混ざる' }],
    answers: [],
  };

  const runner = new PlaywrightQARunner('https://staging.ubie.app');
  runner.setEngine('c-diagnosis');
  runner.setRandomSeed(12345);

  await runner.init(false); // ブラウザを表示
  const result = await runner.runScenario(scenario);

  console.log('✅ 結果画面に到達しました');
  console.log(`📊 疾患数: ${result.diseases.length}`);
  console.log(`📋 質問数: ${result.questionCount}\n`);

  // 結果画面を再度開いて詳細に調査
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 同じシナリオでもう一度実行して結果画面へ
  console.log('🔄 結果画面を再度開いて詳細調査中...\n');

  const runner2 = new PlaywrightQARunner('https://staging.ubie.app');
  runner2.setEngine('c-diagnosis');
  runner2.setRandomSeed(12345);
  await runner2.init(false);
  await runner2.runScenario(scenario);

  // ページのHTMLを取得
  const html = await page.content();

  // HTMLをファイルに保存
  fs.writeFileSync('result-page.html', html);
  console.log('📄 HTMLを保存: result-page.html');

  // スクリーンショットを撮影
  await page.screenshot({ path: 'result-page.png', fullPage: true });
  console.log('📸 スクリーンショットを保存: result-page.png');

  // ページの構造を解析
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 結果画面の構造:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // セクションごとに調査
  const sections = await page.$$('section, div[data-testid], div[class*="section"]');
  console.log(`📦 セクション数: ${sections.length}\n`);

  // 疾患セクション
  const diseaseButtons = await page.$$('button[data-disease-id], button[data-testid*="disease"]');
  console.log(`🏥 疾患ボタン数: ${diseaseButtons.length}`);

  // オンライン診療
  const onlineConsultation = await page.$('text=/オンライン診療/i, [data-testid*="online"]');
  console.log(`💻 オンライン診療セクション: ${onlineConsultation ? 'あり' : 'なし'}`);

  // バナー
  const banners = await page.$$('img[src*="banner"], div[class*="banner"]');
  console.log(`🎨 バナー数: ${banners.length}`);

  // 見出し要素をすべて取得
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 見出し一覧:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const headings = await page.$$('h1, h2, h3, h4');
  for (let i = 0; i < headings.length; i++) {
    const text = await headings[i].textContent();
    const tagName = await headings[i].evaluate(el => el.tagName);
    if (text && text.trim()) {
      console.log(`${tagName}: ${text.trim()}`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 調査完了');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('💡 次のステップ:');
  console.log('1. result-page.html を開いて構造を確認');
  console.log('2. result-page.png を見て画面レイアウトを確認');
  console.log('3. どの要素を検知したいか決める\n');

  await browser.close();
  await runner.close();
  await runner2.close();
}

analyzeResultPage().catch(console.error);
