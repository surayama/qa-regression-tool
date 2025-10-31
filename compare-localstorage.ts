import { chromium } from 'playwright';

/**
 * c-diagnosisとaskmanでLocalStorageの値を比較
 */
async function compareLocalStorage() {
  console.log('🔍 LocalStorage比較テスト開始\n');

  // c-diagnosis
  console.log('📍 C-Diagnosis実行中...');
  const cStorage = await runQuestionnaire('c-diagnosis');

  // askman
  console.log('\n📍 Askman実行中...');
  const aStorage = await runQuestionnaire('askman');

  // 比較
  console.log('\n' + '='.repeat(80));
  console.log('📊 LocalStorage比較結果');
  console.log('='.repeat(80));

  console.log('\n[C-Diagnosis]:');
  console.log('  medico-user:', JSON.stringify(cStorage.medicoUser, null, 2));
  console.log('  user-info:', JSON.stringify(cStorage.userInfo, null, 2));

  console.log('\n[Askman]:');
  console.log('  medico-user:', JSON.stringify(aStorage.medicoUser, null, 2));
  console.log('  user-info:', JSON.stringify(aStorage.userInfo, null, 2));

  // 差分チェック
  console.log('\n' + '-'.repeat(80));
  console.log('📊 差分チェック');
  console.log('-'.repeat(80));

  // medico-user比較
  console.log('\n[medico-user]');
  const cMedicoAge = cStorage.medicoUser?.medicoUser?.age;
  const aMedicoAge = aStorage.medicoUser?.medicoUser?.age;
  const cMedicoSex = cStorage.medicoUser?.medicoUser?.sex;
  const aMedicoSex = aStorage.medicoUser?.medicoUser?.sex;

  if (cMedicoAge === aMedicoAge && cMedicoSex === aMedicoSex) {
    console.log('  ✅ age, sex: 一致');
  } else {
    console.log('  ❌ age, sex: 不一致');
    console.log(`    - age: C-Diagnosis=${cMedicoAge}, Askman=${aMedicoAge}`);
    console.log(`    - sex: C-Diagnosis=${cMedicoSex}, Askman=${aMedicoSex}`);
  }

  // user-info比較
  console.log('\n[user-info]');
  const cUserAge = cStorage.userInfo?.age;
  const aUserAge = aStorage.userInfo?.age;
  const cUserSex = cStorage.userInfo?.sex;
  const aUserSex = aStorage.userInfo?.sex;

  if (cUserAge === aUserAge && cUserSex === aUserSex) {
    console.log('  ✅ age, sex: 一致');
  } else {
    console.log('  ❌ age, sex: 不一致');
    console.log(`    - age: C-Diagnosis=${cUserAge}, Askman=${aUserAge}`);
    console.log(`    - sex: C-Diagnosis=${cUserSex}, Askman=${aUserSex}`);
  }
}

async function runQuestionnaire(mode: 'c-diagnosis' | 'askman'): Promise<any> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const baseUrl = 'https://staging.ubie.app';
  let url = `${baseUrl}?iam_ubie_developer=1`;
  if (mode === 'askman') {
    url += '&use_askman_qa=1';
  }

  await page.goto(url);
  await page.waitForTimeout(2000);

  // 「気になる症状をWeb版で調べる」をクリック
  await page.getByRole('button', { name: '気になる症状をWeb版で調べる' }).click();
  await page.waitForTimeout(1000);

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

  // LocalStorageの medico-user と user-info を取得
  const storageData = await page.evaluate(() => {
    const medicoUserValue = localStorage.getItem('medico-user');
    const userInfoValue = localStorage.getItem('user-info');

    return {
      medicoUser: medicoUserValue ? JSON.parse(medicoUserValue) : null,
      userInfo: userInfoValue ? JSON.parse(userInfoValue) : null,
    };
  });

  await browser.close();

  console.log(`  ✓ ${mode} 完了`);
  return storageData;
}

compareLocalStorage().catch(console.error);
