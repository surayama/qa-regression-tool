import { PlaywrightQARunner } from './src/runners/PlaywrightQARunner';
import { chromium, Page } from 'playwright';
import * as fs from 'fs';

async function extractResultPagePatterns() {
  console.log('🔍 結果画面のパターンを抽出中...\n');

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

  await runner.init(true); // ヘッドレスモード
  const result = await runner.runScenario(scenario);

  console.log('✅ 結果画面に到達しました\n');

  // ブラウザを再度開いて結果画面のHTMLを取得
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // staging.ubie.app/qa/result に直接アクセスはできないので、
  // もう一度問診を実行して結果画面まで到達
  const runner2 = new PlaywrightQARunner('https://staging.ubie.app');
  runner2.setEngine('c-diagnosis');
  runner2.setRandomSeed(12345);

  // runnerのページを取得するため、内部的に実行
  const browser2 = await chromium.launch({ headless: true, args: ['--incognito'] });
  const context2 = await browser2.newContext();
  const page2 = await context2.newPage();

  // 開発者モードで開始
  const testRunId = Date.now();
  const url = `https://staging.ubie.app?iam_ubie_developer=1&test_run_id=${testRunId}&force_repeater=1&sandbox_mode=1`;

  await page2.goto(url);
  await page2.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page2.goto(url);

  // 基本情報を入力して結果画面まで進む（簡易版）
  console.log('📍 問診を自動実行中...');

  // 関係性
  await page2.waitForTimeout(2000);
  const myselfButton = page2.getByRole('button', { name: '自分' });
  if (await myselfButton.isVisible({ timeout: 5000 })) {
    await myselfButton.click();
    await page2.waitForTimeout(1000);
  }

  // 年齢
  await page2.waitForTimeout(1000);
  const ageInput = page2.locator('input[type="number"]').first();
  if (await ageInput.isVisible({ timeout: 5000 })) {
    await ageInput.fill('50');
    const nextButton = page2.getByRole('button', { name: '次へ' });
    await nextButton.click();
    await page2.waitForTimeout(1000);
  }

  // 性別
  const maleButton = page2.getByRole('button', { name: '男性' });
  if (await maleButton.isVisible({ timeout: 5000 })) {
    await maleButton.click();
    await page2.waitForTimeout(1000);
  }

  // 身長・体重（簡易的に）
  for (let i = 0; i < 2; i++) {
    const input = page2.locator('input[type="number"]').first();
    if (await input.isVisible({ timeout: 3000 })) {
      await input.fill('170');
      const next = page2.getByRole('button', { name: '次へ' });
      await next.click();
      await page2.waitForTimeout(1000);
    }
  }

  // 主訴入力
  const complaintInput = page2.locator('input[type="text"], input[placeholder]').first();
  if (await complaintInput.isVisible({ timeout: 5000 })) {
    await complaintInput.fill('咳が出る');
    await page2.waitForTimeout(1000);

    // サジェストをクリック
    const suggestion = page2.locator('button, div[role="button"]').filter({ hasText: '咳' }).first();
    if (await suggestion.isVisible({ timeout: 3000 })) {
      await suggestion.click();
      await page2.waitForTimeout(1000);
    }
  }

  // 確認ボタン
  const proceedButton = page2.getByRole('button', { name: '次へ進む' });
  if (await proceedButton.isVisible({ timeout: 5000 })) {
    await proceedButton.click();
    await page2.waitForTimeout(2000);
  }

  // 質問を適当に答えて結果画面へ（スキップボタンを連打）
  console.log('📍 質問に回答中...');
  for (let i = 0; i < 30; i++) {
    const currentUrl = page2.url();

    // 結果画面に到達したか確認
    if (currentUrl.includes('/qa/result')) {
      console.log('✅ 結果画面に到達しました');
      break;
    }

    // 「ここまでの回答で結果を見る」ボタンを探す
    const seeResultButton = page2.getByRole('button', { name: 'ここまでの回答で結果を見る' });
    if (await seeResultButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await seeResultButton.click();
      await page2.waitForTimeout(2000);
      continue;
    }

    // 「回答をとばす」ボタンを探す
    const skipButton = page2.getByRole('button', { name: '回答をとばす' });
    if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipButton.click();
      await page2.waitForTimeout(500);
      continue;
    }

    // その他のボタンをクリック
    const buttons = await page2.locator('button:visible').all();
    if (buttons.length > 0) {
      await buttons[0].click();
      await page2.waitForTimeout(500);
    }
  }

  // サインアップスキップ
  const noSignupButton = page2.getByRole('button', { name: 'いいえ' });
  if (await noSignupButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await noSignupButton.click();
    await page2.waitForTimeout(1000);
  }

  // 「次へ」で結果画面へ
  const finalNextButton = page2.getByRole('button', { name: '次へ' });
  if (await finalNextButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await finalNextButton.click();
    await page2.waitForTimeout(5000); // 結果生成待ち
  }

  // 結果画面のURLを確認
  const finalUrl = page2.url();
  console.log(`📍 最終URL: ${finalUrl}\n`);

  if (!finalUrl.includes('/qa/result')) {
    console.log('❌ 結果画面に到達できませんでした');
    await browser2.close();
    await runner.close();
    return;
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 結果画面の構造を解析中...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // HTMLを取得
  const html = await page2.content();
  fs.writeFileSync('result-page-full.html', html);
  console.log('✅ HTMLを保存: result-page-full.html\n');

  // スクリーンショット
  await page2.screenshot({ path: 'result-page-full.png', fullPage: true });
  console.log('✅ スクリーンショットを保存: result-page-full.png\n');

  // パターンを抽出
  await analyzePatterns(page2);

  await browser2.close();
  await runner.close();
}

async function analyzePatterns(page: Page) {
  const patterns: any = {};

  // 1. 見出しを全て取得
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 見出し一覧:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const headings = await page.$$('h1, h2, h3, h4, h5, h6');
  patterns.headings = [];

  for (const heading of headings) {
    const tagName = await heading.evaluate(el => el.tagName);
    const text = await heading.textContent();
    if (text && text.trim()) {
      const trimmedText = text.trim();
      console.log(`${tagName}: ${trimmedText}`);
      patterns.headings.push({ tag: tagName, text: trimmedText });
    }
  }

  // 2. data-testid 属性を持つ要素
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏷️  data-testid 属性:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const testIdElements = await page.$$('[data-testid]');
  patterns.testIds = [];
  const uniqueTestIds = new Set<string>();

  for (const el of testIdElements) {
    const testId = await el.getAttribute('data-testid');
    if (testId && !uniqueTestIds.has(testId)) {
      uniqueTestIds.add(testId);
      patterns.testIds.push(testId);
    }
  }

  Array.from(uniqueTestIds).sort().forEach(id => {
    console.log(`  - ${id}`);
  });

  // 3. ID属性（GTM系）
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🆔 ID属性（GTM-で始まる）:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const gtmElements = await page.$$('[id^="GTM-"]');
  patterns.gtmIds = [];
  const uniqueGtmIds = new Set<string>();

  for (const el of gtmElements) {
    const id = await el.getAttribute('id');
    if (id) {
      // プレフィックスを抽出（例: GTM-disease_card_xxx → GTM-disease_card_）
      const prefix = id.replace(/_[^_]+$/, '_');
      uniqueGtmIds.add(prefix);
    }
  }

  Array.from(uniqueGtmIds).sort().forEach(id => {
    console.log(`  - ${id}*`);
  });

  // 4. ボタンのテキスト一覧
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔘 ボタン一覧:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const buttons = await page.$$('button');
  patterns.buttons = [];

  for (const button of buttons) {
    const text = await button.textContent();
    const id = await button.getAttribute('id');
    const testId = await button.getAttribute('data-testid');

    if (text && text.trim() && !text.includes('GTM-disease_card')) {
      const info: any = { text: text.trim() };
      if (id) info.id = id;
      if (testId) info.testId = testId;
      patterns.buttons.push(info);

      console.log(`  - "${text.trim()}"${id ? ` [id=${id}]` : ''}${testId ? ` [data-testid=${testId}]` : ''}`);
    }
  }

  // 5. 画像・バナー
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🖼️  画像・バナー:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const images = await page.$$('img');
  patterns.images = [];

  for (const img of images) {
    const src = await img.getAttribute('src');
    const alt = await img.getAttribute('alt');

    if (src) {
      const info: any = { src };
      if (alt) info.alt = alt;
      patterns.images.push(info);

      console.log(`  - ${src}${alt ? ` (alt: ${alt})` : ''}`);
    }
  }

  // 6. リンクパターン
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔗 リンク（オンライン診療など）:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const links = await page.$$('a[href]');
  patterns.links = [];

  for (const link of links) {
    const href = await link.getAttribute('href');
    const text = await link.textContent();

    if (href && text && text.trim()) {
      const info = { href, text: text.trim() };
      patterns.links.push(info);

      if (text.includes('オンライン') || text.includes('診療') || text.includes('病院') || text.includes('検索')) {
        console.log(`  - "${text.trim()}" → ${href}`);
      }
    }
  }

  // パターンをJSONファイルに保存
  fs.writeFileSync('result-page-patterns.json', JSON.stringify(patterns, null, 2));
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ パターンをJSONに保存: result-page-patterns.json');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('💡 次のステップ:');
  console.log('1. result-page-patterns.json を確認');
  console.log('2. result-page-full.html をブラウザで開いて構造確認');
  console.log('3. result-page-full.png で画面レイアウト確認');
  console.log('4. どの要素を検知したいか決定\n');
}

extractResultPagePatterns().catch(console.error);
