import { PlaywrightQARunner } from './src/runners/PlaywrightQARunner';
import { Page } from 'playwright';
import * as fs from 'fs';

/**
 * 既存のPlaywrightQARunnerを使って結果画面まで到達し、
 * そこからパターンを抽出する
 */
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

  await runner.init(false); // ヘッドレス=falseで実行（デバッグ用）

  console.log('📍 問診を実行中...\n');
  const result = await runner.runScenario(scenario, true); // keepPageOpen=trueでページを開いたままにする

  console.log('✅ 結果画面に到達しました\n');
  console.log(`質問数: ${result.questionCount}`);
  console.log(`検出した疾患数: ${result.diseases.length}\n`);

  // ページオブジェクトを取得
  const page = result.page;
  const context = result.context;

  if (!page || !context) {
    console.error('❌ ページオブジェクトが取得できませんでした');
    await runner.close();
    return;
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 結果画面の構造を解析中...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // HTMLとスクリーンショットを保存
  const html = await page.content();
  fs.writeFileSync('result-page-full.html', html);
  console.log('✅ HTMLを保存: result-page-full.html\n');

  await page.screenshot({ path: 'result-page-full.png', fullPage: true });
  console.log('✅ スクリーンショットを保存: result-page-full.png\n');

  // パターンを抽出
  const patterns = await analyzePatterns(page);

  // パターンをJSONファイルに保存
  fs.writeFileSync('result-page-patterns.json', JSON.stringify(patterns, null, 2));
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ パターンをJSONに保存: result-page-patterns.json');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('💡 次のステップ:');
  console.log('1. result-page-patterns.json を確認して新しい要素を特定');
  console.log('2. result-page-full.html をブラウザで開いて構造確認');
  console.log('3. result-page-full.png で画面レイアウト確認');
  console.log('4. getDiseaseResults() を拡張して新しい要素を検出\n');

  // ページとコンテキストをクローズ
  await page.close();
  await context.close();
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

  // 3. ID属性（GTM系とその他）
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🆔 ID属性:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const elementsWithId = await page.$$('[id]');
  patterns.ids = [];
  const uniqueIds = new Set<string>();

  for (const el of elementsWithId) {
    const id = await el.getAttribute('id');
    if (id && !id.startsWith('radix-') && !uniqueIds.has(id)) {
      uniqueIds.add(id);

      // GTM-で始まるIDはプレフィックスを抽出
      if (id.startsWith('GTM-')) {
        const prefix = id.replace(/_[^_]+$/, '_');
        patterns.ids.push({ type: 'GTM', pattern: prefix + '*' });
      } else {
        patterns.ids.push({ type: 'other', id });
      }
    }
  }

  // 重複を排除してソート
  const uniquePatterns = new Map();
  patterns.ids.forEach((item: any) => {
    const key = item.pattern || item.id;
    uniquePatterns.set(key, item);
  });

  patterns.ids = Array.from(uniquePatterns.values()).sort((a, b) => {
    const aKey = a.pattern || a.id;
    const bKey = b.pattern || b.id;
    return aKey.localeCompare(bKey);
  });

  patterns.ids.forEach((item: any) => {
    if (item.type === 'GTM') {
      console.log(`  - ${item.pattern} (GTM)`);
    } else {
      console.log(`  - ${item.id}`);
    }
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

    if (text && text.trim()) {
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

  // 6. リンクパターン（オンライン診療など）
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔗 リンク（オンライン診療・病院検索など）:');
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

  // 7. セクション構造（divやsectionの階層）
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 セクション構造（疾患枠の候補）:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 見出しの近くにあるGTM-disease_cardを含むセクションを探す
  patterns.sections = [];

  // 全ての疾患カードボタンを取得
  const allDiseaseCards = await page.$$('button[id^="GTM-disease_card_"]');

  // 各見出しについて、その下にある疾患カードを数える
  for (const heading of patterns.headings) {
    const headingText = heading.text;

    try {
      // この見出し要素を取得
      const headingElements = await page.$$(`${heading.tag}`);

      for (const headingEl of headingElements) {
        const text = await headingEl.textContent();
        if (text && text.trim() === headingText) {
          // この見出しの後ろにある要素を探す（親要素を使った探索）
          const parent = await headingEl.evaluateHandle(el => el.parentElement);
          const diseaseCardsInSection = await parent.$$('button[id^="GTM-disease_card_"]');

          if (diseaseCardsInSection.length > 0) {
            const section = {
              heading: headingText,
              headingTag: heading.tag,
              diseaseCount: diseaseCardsInSection.length,
            };
            patterns.sections.push(section);
            console.log(`  - ${headingText} (${heading.tag}): ${diseaseCardsInSection.length}個の疾患カード`);
          }
          break;
        }
      }
    } catch (error) {
      // エラーは無視して次の見出しへ
    }
  }

  if (patterns.sections.length === 0) {
    console.log('  (疾患カードを含むセクションが見つかりませんでした)');
  }

  return patterns;
}

extractResultPagePatterns().catch(console.error);
