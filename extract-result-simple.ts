import { chromium } from 'playwright';
import * as fs from 'fs';

/**
 * 既存のレポートから結果画面のURLを取得して、
 * そのページのパターンを抽出する
 */
async function extractFromExistingResult() {
  console.log('🔍 既存の結果画面からパターンを抽出します\n');

  // ブラウザ起動
  const browser = await chromium.launch({
    headless: true,
    args: ['--incognito'],
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // staging.ubie.appの結果ページは認証が必要なので、
  // まずログインなしでアクセスできるページで開発者モードのパラメータを試す
  //
  // 代わりに、シンプルなシナリオで問診を実行する最小限の実装

  const testRunId = Date.now();
  const url = `https://staging.ubie.app?iam_ubie_developer=1&test_run_id=${testRunId}&force_repeater=1&sandbox_mode=1`;

  console.log(`📍 開発者モードでアクセス: ${url}\n`);

  await page.goto(url);
  await page.waitForTimeout(3000);

  // ストレージクリア
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.goto(url);
  await page.waitForTimeout(3000);

  // 自動操作ではなく、既存のレポートファイルの情報を使う
  console.log('💡 代わりに、既存のレポートHTMLから結果画面の構造を読み取ります\n');

  // reportsフォルダから最新のJSONファイルを読み込む
  const reportFiles = fs.readdirSync('reports').filter(f => f.endsWith('.json'));
  if (reportFiles.length === 0) {
    console.log('❌ レポートファイルが見つかりません');
    await browser.close();
    return;
  }

  const latestReport = reportFiles.sort().reverse()[0];
  console.log(`📂 最新のレポート: ${latestReport}\n`);

  // とりあえず、stagingの結果画面に手動で遷移してもらう方法を提案
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 手動での結果画面アクセス方法:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('1. https://staging.ubie.app にアクセス');
  console.log('2. 問診を実行して結果画面まで到達');
  console.log('3. ブラウザのDeveloper Tools (Cmd+Option+I) を開く');
  console.log('4. Console タブで以下を実行:\n');
  console.log('   document.documentElement.outerHTML\n');
  console.log('5. 出力されたHTMLをコピーして result-manual.html として保存\n');

  console.log('または、より簡単な方法として:\n');
  console.log('1. 結果画面で右クリック → 「ページのソースを表示」');
  console.log('2. 全選択 (Cmd+A) → コピー (Cmd+C)');
  console.log('3. result-manual.html として保存\n');

  await browser.close();

  // 代替: screenshotsフォルダから既存のスクリーンショットを解析
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📸 または、既存のレポートを参照:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`reports/${latestReport} を確認してください\n`);

  // JSONを読み込んで構造を確認
  const reportData = JSON.parse(fs.readFileSync(`reports/${latestReport}`, 'utf-8'));

  console.log('現在取得している情報:');
  console.log(`- 疾患数: ${reportData.diseases?.cDiagnosis?.length || 0} (c-diagnosis)`);
  console.log(`- 疾患数: ${reportData.diseases?.askman?.length || 0} (askman)`);
  console.log(`- 質問数: ${reportData.summary?.cDiagnosis?.questionCount || 0} (c-diagnosis)`);
  console.log(`- 質問数: ${reportData.summary?.askman?.questionCount || 0} (askman)\n`);

  if (reportData.diseases?.cDiagnosis) {
    console.log('取得済みの疾患（c-diagnosis）:');
    reportData.diseases.cDiagnosis.forEach((d: any) => {
      console.log(`  - ${d.name} [${d.section || 'unknown'}]`);
    });
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💡 次のステップ:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Mayさん、以下のいずれかの方法で結果画面のHTMLを取得してください:');
  console.log('1. 手動で結果画面のHTMLをコピーして result-manual.html として保存');
  console.log('2. 結果画面のスクリーンショットを共有');
  console.log('3. 既知の見出し・要素名を教えてください（例: "既往疾患", "無症状疾患"）\n');
}

extractFromExistingResult().catch(console.error);
