import { PlaywrightQARunner } from './src/runners/PlaywrightQARunner';
import { ComparisonEngine } from './src/comparison/ComparisonEngine';
import { ReportWriter } from './src/reporters/ReportWriter';
import { TestScenario } from './src/types';

async function test() {
  console.log('📁 フォルダ構造テスト開始\n');

  const scenario: TestScenario = {
    name: '25歳男性・頭痛',
    user: { age: 25, sex: 'male', relationship: 'myself' },
    complaints: [{ id: 'headache', text: '頭痛がする' }],
    answers: [],
  };

  const cRunner = new PlaywrightQARunner('https://staging.ubie.app');
  cRunner.setEngine('c-diagnosis');
  cRunner.setRandomSeed(12345);

  const aRunner = new PlaywrightQARunner('https://staging.ubie.app');
  aRunner.setEngine('askman');
  aRunner.setRandomSeed(12345);

  await Promise.all([cRunner.init(true), aRunner.init(true)]);

  const [cResult, aResult] = await Promise.all([
    cRunner.runScenario(scenario),
    aRunner.runScenario(scenario),
  ]);

  const comparisonEngine = new ComparisonEngine();
  const comparison = comparisonEngine.compare(cResult, aResult);

  console.log(`\n📁 Output directory: ${comparison.outputDir}\n`);

  // スクリーンショットを移動
  if (comparison.outputDir) {
    const fs = await import('fs');
    if (cResult.screenshotPath && fs.existsSync(cResult.screenshotPath)) {
      const newPath = `${comparison.outputDir}/c-diagnosis-result.png`;
      fs.renameSync(cResult.screenshotPath, newPath);
      cResult.screenshotPath = newPath;
      console.log(`✓ C-Diagnosis screenshot moved to: ${newPath}`);
    }
    if (aResult.screenshotPath && fs.existsSync(aResult.screenshotPath)) {
      const newPath = `${comparison.outputDir}/askman-result.png`;
      fs.renameSync(aResult.screenshotPath, newPath);
      aResult.screenshotPath = newPath;
      console.log(`✓ Askman screenshot moved to: ${newPath}`);
    }
  }

  const formattedReport = comparisonEngine.formatResult(comparison);

  const reportWriter = new ReportWriter();
  const txtPath = await reportWriter.saveReport(comparison, formattedReport);
  const jsonPath = await reportWriter.saveReportJSON(comparison);

  console.log(`\n✓ Text report saved: ${txtPath}`);
  console.log(`✓ JSON report saved: ${jsonPath}`);

  await Promise.all([cRunner.close(), aRunner.close()]);

  // フォルダの中身を確認
  if (comparison.outputDir) {
    const fs = await import('fs');
    const files = fs.readdirSync(comparison.outputDir);
    console.log(`\n📂 Files in ${comparison.outputDir}:`);
    files.forEach(file => console.log(`  - ${file}`));
  }
}

test().catch(console.error);
