import { chromium } from 'playwright';

/**
 * LocalStorageの内容を確認するスクリプト
 */
async function checkLocalStorage() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const baseUrl = 'https://staging.ubie.app';
  const url = `${baseUrl}?iam_ubie_developer=1`;

  console.log('🔧 問診を開始...');
  await page.goto(url);
  await page.waitForTimeout(2000);

  // 「気になる症状をWeb版で調べる」をクリック
  await page.getByRole('button', { name: '気になる症状をWeb版で調べる' }).click();
  await page.waitForTimeout(2000);

  // 関係性選択
  await page.getByRole('button', { name: '自分' }).first().click();
  await page.waitForTimeout(1000);

  // 年齢入力
  await page.fill('input', '30');
  await page.getByRole('button', { name: '次へ' }).click();
  await page.waitForTimeout(1000);

  // 性別選択
  await page.getByRole('button', { name: '男性' }).click();
  await page.waitForTimeout(2000);

  // LocalStorageの内容を取得
  console.log('\n📦 LocalStorage の内容:');
  console.log('='.repeat(80));

  const localStorageData = await page.evaluate(() => {
    const data: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        try {
          // JSONとしてパースを試みる
          data[key] = JSON.parse(value || '');
        } catch {
          // パースできない場合はそのまま
          data[key] = value;
        }
      }
    }
    return data;
  });

  // キーごとに表示
  for (const [key, value] of Object.entries(localStorageData)) {
    console.log(`\nKey: ${key}`);
    console.log('-'.repeat(80));
    if (typeof value === 'object') {
      console.log(JSON.stringify(value, null, 2));
    } else {
      console.log(value);
    }
  }

  console.log('\n\n📊 合計キー数:', Object.keys(localStorageData).length);

  await page.waitForTimeout(3000);
  await browser.close();
}

checkLocalStorage().catch(console.error);
