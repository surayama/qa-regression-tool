import { chromium, Browser, Page } from 'playwright';
import { TestScenario, TestResult, DiseaseResult, QuestionLog } from '../types';

/**
 * PlaywrightベースのQAランナー
 * ブラウザ操作を自動化して問診を実行
 *
 * toc-e2eテストの調査に基づく:
 * - 開発者モードにiam_ubie_developer=1を使用
 * - テスト環境にsandbox_mode=1を使用
 * - Cookie チェックを回避するためforce_repeater=1を使用
 */
export class PlaywrightQARunner {
  private baseUrl: string;
  private browser: Browser | null = null;
  private engine: 'c-diagnosis' | 'askman' | null = null;
  private randomSeed: number | null = null;
  private randomState: number = 0;

  constructor(baseUrl: string = 'https://staging.ubie.app') {
    this.baseUrl = baseUrl;
  }

  /**
   * 再現可能なランダム選択のためのシード値を設定
   * @param seed ランダムシード (nullの場合、デフォルトのスキップ動作)
   */
  setRandomSeed(seed: number | null): void {
    this.randomSeed = seed;
    this.randomState = seed || 0;
  }

  /**
   * シード付き乱数生成器 (LCGアルゴリズム)
   * 0から1の数値を返す
   */
  private seededRandom(): number {
    if (this.randomSeed === null) {
      return Math.random();
    }
    // 線形合同法
    this.randomState = (this.randomState * 1664525 + 1013904223) % 4294967296;
    return this.randomState / 4294967296;
  }

  /**
   * 設問文に基づいて決定論的なランダムインデックスを取得
   * 同じ設問文は常に同じインデックスを返す
   */
  private getRandomIndexForQuestion(questionText: string, optionCount: number): number {
    if (this.randomSeed === null) {
      return Math.floor(Math.random() * optionCount);
    }

    // 設問文をハッシュ化して一貫した数値を得る
    let hash = 0;
    for (let i = 0; i < questionText.length; i++) {
      hash = ((hash << 5) - hash) + questionText.charCodeAt(i);
      hash = hash & hash; // 32ビット整数に変換
    }

    // シードと組み合わせて決定論的に
    const combined = Math.abs(hash + this.randomSeed);
    return combined % optionCount;
  }

  private getRandomValueInRange(questionKey: string, min: number, max: number): number {
    if (this.randomSeed === null) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // 設問キーをハッシュ化して一貫した数値を得る
    let hash = 0;
    for (let i = 0; i < questionKey.length; i++) {
      hash = ((hash << 5) - hash) + questionKey.charCodeAt(i);
      hash = hash & hash; // 32ビット整数に変換
    }

    // シードと組み合わせて決定論的に
    const combined = Math.abs(hash + this.randomSeed);
    return (combined % (max - min + 1)) + min;
  }

  setEngine(engine: 'c-diagnosis' | 'askman'): void {
    this.engine = engine;
  }

  async init(headless: boolean = true): Promise<void> {
    this.browser = await chromium.launch({
      headless, // デバッグ時は上書き可能
      args: [
        '--incognito', // シークレットモードで起動
        '--disable-blink-features=AutomationControlled', // 自動化検出を無効化
      ],
    });
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async runScenario(scenario: TestScenario, outputDir?: string): Promise<TestResult> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call init() first.');
    }

    const startTime = Date.now();

    // 新しい分離ブラウザコンテキストを作成 (シークレットモード)
    // 以前の実行のキャッシュ、Cookie、localStorageがないことを保証
    const context = await this.browser.newContext({
      // キャッシュを無効化
      ignoreHTTPSErrors: true,
      // Service workerとキャッシュを無効化
      serviceWorkers: 'block',
      // CookieとStorageをクリア (毎回新規開始)
      storageState: undefined,
      // HTTPキャッシュを無効化
      extraHTTPHeaders: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
      // 識別用のUser Agent
      userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 QA-Test/${this.engine || 'unknown'}`,
    });

    const page = await context.newPage();

    // ビューポートを設定
    await page.setViewportSize({ width: 1200, height: 800 });

    // 開始前にCookieをクリア (クリーンな状態を保証)
    await context.clearCookies();

    // エラーリカバリのため進捗を追跡
    let questionCount = 0;
    let questionLogs: QuestionLog[] = [];
    let diseases: DiseaseResult[] = [];

    try {
      console.log(`      🌐 問診を開始: ${this.engine || 'default'} エンジン...`);

      // 1. 問診を開始 (必要に応じてaskmanモードを有効化)
      await this.startQuestionnaire(page);

      // 2. 基本情報 (年齢、性別、身長/体重) を入力してログを収集
      const basicInfoLogs = await this.enterBasicInfo(page, scenario);
      questionLogs = basicInfoLogs;

      // 3. 質問に回答（主訴入力を含む）
      const questionResult = await this.answerQuestions(page, scenario, basicInfoLogs.length, 50);
      questionCount = basicInfoLogs.length + questionResult.count;
      questionLogs = [...basicInfoLogs, ...questionResult.logs];

      // 5. 結果ページに移動（Extra Questionsも処理してログを取得）
      const goToResultResponse = await this.goToResult(page, questionCount);

      // Extra Questionsのログをマージ
      questionCount += goToResultResponse.logs.length;
      questionLogs = [...questionLogs, ...goToResultResponse.logs];

      // 6. 疾患結果を取得
      diseases = await this.getDiseaseResults(page);

      // 7. LocalStorageスナップショットを取得
      const localStorageSnapshot = await this.getLocalStorageSnapshot(page);

      // 8. 成功時に結果画面のスクリーンショットを撮影
      const successScreenshotPath = await this.takeSuccessScreenshot(page, outputDir);

      const executionTimeMs = Date.now() - startTime;

      await page.close();
      await context.close(); // コンテキストをクリーンアップして状態の漏洩を防止

      return {
        scenario,
        diseases,
        questionCount,
        questionLogs,
        localStorageSnapshot,
        executionTimeMs,
        screenshotPath: successScreenshotPath,  // 成功時の結果画面スクリーンショット
      };
    } catch (error) {
      console.log(`      ❌ 問診中にエラー: ${error instanceof Error ? error.message : String(error)}`);

      // エラー時にスクリーンショットを保存
      let screenshotPath: string | undefined;
      try {
        const errorFileName = `error-${this.engine || 'unknown'}.png`;
        screenshotPath = outputDir ? `${outputDir}/${errorFileName}` : `screenshots/${errorFileName}`;
        await page.screenshot({ path: screenshotPath });
        console.log(`      📸 スクリーンショット保存: ${screenshotPath}`);
      } catch {}

      await page.close();
      await context.close(); // エラー時でもコンテキストをクリーンアップ

      const executionTimeMs = Date.now() - startTime;

      // 可能であれば部分的な結果を返す (例: 質問に回答したが結果ページに失敗)
      return {
        scenario,
        diseases,  // 空または部分的な可能性
        questionCount,  // エラー前に回答した質問数
        questionLogs,  // エラー前に収集されたログ
        executionTimeMs,
        error: error instanceof Error ? error.message : String(error),
        screenshotPath,  // エラースクリーンショットのパス
      };
    }
  }

  /**
   * ホームページから問診を開始
   */
  private async startQuestionnaire(page: Page): Promise<void> {
    // 必要に応じてaskmanパラメータ付きURLを構築
    let url = `${this.baseUrl}?iam_ubie_developer=1`;
    if (this.engine === 'askman') {
      url += '&use_askman_qa=1';
    }

    console.log(`      🔧 開発者モードで開始: ${url}`);

    // まずストレージをクリア、次に開発者モードパラメータでロード
    console.log('      🧹 ストレージをクリア中...');
    await page.goto(this.baseUrl);
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        // Storageが利用できない場合はエラーを無視
      }
    });

    // IndexedDBをクリア（別の evaluate で実行）
    await page.evaluate(() => {
      // @ts-ignore
      if (typeof indexedDB !== 'undefined') {
        // @ts-ignore
        indexedDB.databases().then((dbs) => {
          // @ts-ignore
          dbs.forEach((db) => {
            if (db.name) {
              // @ts-ignore
              indexedDB.deleteDatabase(db.name);
            }
          });
        }).catch(() => {});
      }
    });

    // クッキーもクリア
    await page.context().clearCookies();

    console.log('      🔄 開発者モードパラメータでロード中...');
    await page.goto(url);
    await page.waitForTimeout(2000);

    // 開発者モードのピンクバナーを表示するためにリロード
    console.log('      🔄 開発者モードバナーを表示するためにリロード中...');
    await page.reload();
    await page.waitForTimeout(2000);

    // 「気になる症状をWeb版で調べる」をクリック
    try {
      await page.getByRole('button', { name: '気になる症状をWeb版で調べる' }).click({ timeout: 10000 });
    } catch (error) {
      console.log(`      ⚠️  '気になる症状をWeb版で調べる'ボタンが見つかりませんでした`);
      console.log(`      現在のURL: ${page.url()}`);
      throw error;
    }
  }

  /**
   * 基本情報 (年齢、性別、必要に応じて月齢) を入力
   * これらの基本情報ステップの質問ログを返す
   */
  private async enterBasicInfo(page: Page, scenario: TestScenario): Promise<QuestionLog[]> {
    const logs: QuestionLog[] = [];
    let questionNumber = 0;
    // 1. 関係性を選択 (自分/家族/その他)
    if (scenario.user.relationship) {
      console.log(`      関係性を選択: ${scenario.user.relationship}`);

      const relationshipMap = {
        myself: { en: 'Myself', ja: '自分' },
        family: { en: 'Family', ja: '家族' },
        other: { en: 'Other', ja: 'その他' },
      };
      const labels = relationshipMap[scenario.user.relationship];

      // 関係性ページの表示を待つ
      await page.waitForSelector('text=誰の症状', { timeout: 5000 }).catch(() => {});

      const relationshipUrl = page.url();

      // ボタンをクリック（日本語ラベル優先、複数ある場合は最初）
      await page.getByRole('button', { name: labels.ja }).first().click();
      console.log(`      ✓ 関係性を選択: ${labels.ja}`);

      // ログを追加
      questionNumber++;
      logs.push({
        questionNumber,
        url: relationshipUrl.split('?')[0],
        questionText: '誰の症状について調べますか？',
        availableOptions: ['自分', '家族', 'その他'],
        selectedOption: labels.ja,
        timestamp: Date.now(),
      });

      // URLが変わるまで待つ（ページ遷移）
      await page.waitForURL(url => url.toString() !== relationshipUrl, { timeout: 10000 }).catch(() => {
        console.log(`      ⚠️  関係性選択後のページ遷移がタイムアウト`);
      });
    }

    // デバッグ: 現在のページ状態を確認
    console.log(`      現在のURL: ${page.url()}`);
    console.log(`      ページタイトル: ${await page.title()}`);

    // 入力がすでに表示されているか確認 (関係性選択がスキップされた可能性)
    const inputVisible = await page.locator('input').isVisible({ timeout: 2000 }).catch(() => false);
    if (inputVisible) {
      console.log(`      ✓ 入力フィールドはすでに表示されています`);
    } else {
      console.log(`      ⚠️  入力フィールドがまだ表示されていません。待機中...`);
    }

    // 2. 年齢を入力
    await page.waitForSelector('input', { timeout: 15000 });
    const ageUrl = page.url();
    await page.fill('input', scenario.user.age.toString());

    // 年齢入力をログ
    questionNumber++;
    logs.push({
      questionNumber,
      url: ageUrl.split('?')[0],
      questionText: '年齢を教えてください',
      availableOptions: [],
      selectedOption: `${scenario.user.age}歳`,
      timestamp: Date.now(),
    });

    // 複数の「次へ」ボタンセレクタを試行
    await this.clickNextButton(page);

    // 3. 月齢を入力 (0歳の場合)
    if (scenario.user.age === 0 && scenario.user.ageMonth !== undefined) {
      await page.waitForURL(/.*\/qa\/age-month/, { timeout: 10000 });
      await page.fill('input', scenario.user.ageMonth.toString());
      await this.clickNextButton(page);
    }

    // 4. 性別を選択
    // 「性別を教えてください」が出るのを待つ
    await page.waitForSelector('text=性別', { timeout: 15000 });
    const sexUrl = page.url();
    const sexLabel = scenario.user.sex === 'male' ? '男性' : '女性';

    // 男性/女性のボタンをクリック
    await page.getByRole('button', { name: sexLabel }).click();
    console.log(`      ✓ 性別を選択: ${sexLabel}`);

    // 性別選択をログ
    questionNumber++;
    logs.push({
      questionNumber,
      url: sexUrl.split('?')[0],
      questionText: '性別を教えてください',
      availableOptions: ['男性', '女性'],
      selectedOption: sexLabel,
      timestamp: Date.now(),
    });

    // URLが変わるまで待つ（ページ遷移）
    await page.waitForURL(url => url.toString() !== sexUrl, { timeout: 10000 }).catch(() => {
      console.log(`      ⚠️  性別選択後のページ遷移がタイムアウト`);
    });

    // 性別選択後に身長/体重ページが表示される場合があるので処理
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000); // ページが完全にロードされるのを待つ

    const currentUrl = page.url();
    if (currentUrl.includes('/height')) {
      console.log(`      身長ページを検出、ランダムな値を入力します`);
      const heightUrl = currentUrl;

      // スライダーで身長を入力
      const heightSlider = page.locator('input[type="range"], input[type="number"]').first();
      if (await heightSlider.count() > 0) {
        const min = await heightSlider.getAttribute('min');
        const max = await heightSlider.getAttribute('max');
        const minNum = min ? parseInt(min) : 140;
        const maxNum = max ? parseInt(max) : 200;
        const heightValue = this.getRandomValueInRange('height', minNum, maxNum);

        await heightSlider.fill(heightValue.toString());
        console.log(`      ✓ 身長を入力: ${heightValue}cm`);

        questionNumber++;
        logs.push({
          questionNumber,
          url: heightUrl.split('?')[0],
          questionText: '身長を教えてください',
          availableOptions: [`${minNum}-${maxNum}cm`],
          selectedOption: `${heightValue}cm`,
          timestamp: Date.now(),
        });
      } else {
        // スライダーが見つからない場合は体の図をクリックする形式（askman）
        // 体の図の中央付近をクリック
        const bodyFigure = page.locator('svg, canvas').first();
        if (await bodyFigure.count() > 0) {
          const box = await bodyFigure.boundingBox();
          if (box) {
            // 体の中央あたりをクリック（身長157cm相当の位置）
            await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.5);
            console.log(`      ✓ 体の図をクリックして身長を入力`);
            await page.waitForTimeout(500);
          }
        }
      }

      await this.clickNextButton(page);

      // ページ遷移を待つ
      await page.waitForURL(url => url.toString() !== heightUrl, { timeout: 10000 }).catch(() => {
        console.log(`      ⚠️  身長ページ後のページ遷移がタイムアウト`);
      });
      await page.waitForLoadState('domcontentloaded');
    }

    // 体重ページの処理
    await page.waitForTimeout(1000);
    const afterHeightUrl = page.url();
    if (afterHeightUrl.includes('/weight')) {
      console.log(`      体重ページを検出、ランダムな値を入力します`);
      const weightUrl = afterHeightUrl;

      // スライダーで体重を入力
      const weightSlider = page.locator('input[type="range"], input[type="number"]').first();
      if (await weightSlider.count() > 0) {
        const min = await weightSlider.getAttribute('min');
        const max = await weightSlider.getAttribute('max');
        const minNum = min ? parseInt(min) : 30;
        const maxNum = max ? parseInt(max) : 150;
        const weightValue = this.getRandomValueInRange('weight', minNum, maxNum);

        await weightSlider.fill(weightValue.toString());
        console.log(`      ✓ 体重を入力: ${weightValue}kg`);

        questionNumber++;
        logs.push({
          questionNumber,
          url: weightUrl.split('?')[0],
          questionText: '体重を教えてください',
          availableOptions: [`${minNum}-${maxNum}kg`],
          selectedOption: `${weightValue}kg`,
          timestamp: Date.now(),
        });
      } else {
        // スライダーが見つからない場合は体の図をクリックする形式（askman）
        // 体の図の中央付近をクリック
        const bodyFigure = page.locator('svg, canvas').first();
        if (await bodyFigure.count() > 0) {
          const box = await bodyFigure.boundingBox();
          if (box) {
            // 体の中央あたりをクリック（体重50kg相当の位置）
            await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.5);
            console.log(`      ✓ 体の図をクリックして体重を入力`);
            await page.waitForTimeout(500);
          }
        }
      }

      await this.clickNextButton(page);

      // ページ遷移を待つ
      await page.waitForURL(url => url.toString() !== weightUrl, { timeout: 10000 }).catch(() => {
        console.log(`      ⚠️  体重ページ後のページ遷移がタイムアウト`);
      });
      await page.waitForLoadState('domcontentloaded');
    }

    console.log('      ✅ 基本情報の入力が完了しました');
    return logs;
  }

  /**
   * ページから有効なクリック可能ボタンを収集
   */
  private async collectValidButtons(page: Page): Promise<{ button: any; text: string }[]> {
    const validButtons: { button: any; text: string }[] = [];

    // チェックボックスがある場合は、チェックボックスのラベルを収集
    const checkboxes = await page.locator('input[type="checkbox"]:visible').all();
    if (checkboxes.length > 0) {
      for (const checkbox of checkboxes) {
        try {
          // 親ラベルを探す
          const parent = checkbox.locator('xpath=ancestor::label').first();
          const hasParentLabel = await parent.count() > 0;

          if (hasParentLabel) {
            const labelText = await parent.textContent();
            if (labelText && labelText.trim()) {
              validButtons.push({ button: parent, text: labelText.trim() });
            }
          } else {
            // IDベースのラベルを探す
            const checkboxId = await checkbox.getAttribute('id');
            if (checkboxId) {
              const label = page.locator(`label[for="${checkboxId}"]`);
              if (await label.count() > 0) {
                const labelText = await label.first().textContent();
                if (labelText && labelText.trim()) {
                  validButtons.push({ button: label.first(), text: labelText.trim() });
                }
              }
            }
          }
        } catch (error) {
          // ラベル取得エラーは無視
        }
      }

      // チェックボックスページでは「回答をとばす」も追加
      const skipButton = page.getByRole('button', { name: '回答をとばす' });
      if (await skipButton.isVisible({ timeout: 500 }).catch(() => false)) {
        validButtons.push({ button: skipButton, text: '回答をとばす' });
      }

      return validButtons;
    }

    // まず通常のボタンを収集（バッチ処理で高速化）
    const buttons = await page.locator('button:visible:not([disabled])').all();

    // 除外するテキストパターン（デバッグ機能も除外）
    const excludePatterns = ['次へ', '戻る', '閉じる', '途中終了', '意見を送る', 'skip to', 'signup', 'result'];

    for (const button of buttons) {
      const text = await button.textContent();
      if (!text) continue;

      const trimmed = text.trim();
      const shouldExclude = excludePatterns.some(pattern => trimmed.includes(pattern));

      if (!shouldExclude) {
        validButtons.push({ button, text: trimmed });
      }
    }

    // ボタンが見つからない場合、クリック可能なdivを試行 (頻度/場所選択画面用)
    if (validButtons.length === 0) {
      const mainContent = page.locator('xpath=/html/body/div/div/main/div/div[3]');
      const clickables = await mainContent.locator('[role="button"]:visible, div[onclick]:visible').all();

      const excludeDivPatterns = ['回答をとばす', '意見を送る', '前に戻る', 'skip to'];
      const seen = new Set<string>();

      for (const el of clickables) {
        const text = await el.textContent();
        const trimmed = text?.trim() || '';

        if (trimmed.length === 0) continue;

        const shouldExclude = excludeDivPatterns.some(pattern => trimmed.includes(pattern));
        if (shouldExclude || seen.has(trimmed)) continue;

        seen.add(trimmed);
        validButtons.push({ button: el, text: trimmed });
      }
    }

    return validButtons;
  }

  /**
   * 複数のセレクタで「次へ」ボタンをクリック
   */
  private async clickNextButton(page: Page): Promise<void> {
    // 「次へ」ボタンを優先的に探す（「戻る」ボタンを除外）
    const nextButtonSelectors = [
      'button:has-text("次へ"):not(:has-text("戻る"))',
      'button:has-text("Next"):not(:has-text("Back"))',
      'button[type="submit"]:visible',
    ];

    for (const selector of nextButtonSelectors) {
      try {
        const buttons = await page.locator(selector).all();
        for (const button of buttons) {
          const text = await button.textContent();
          // 「戻る」「前に戻る」を含むボタンはスキップ
          if (text && (text.includes('戻る') || text.includes('Back') || text.includes('前に'))) {
            continue;
          }
          if (await button.isVisible()) {
            await button.click();
            console.log(`      ✓ 「次へ」ボタンをクリックしました`);
            return;
          }
        }
      } catch {
        continue;
      }
    }

    throw new Error('Could not find next button');
  }

  /**
   * 質問に自動的に回答
   * toc-e2eパターンに基づく: まず一般的な応答を試行
   * 戻り値: { count: number, logs: QuestionLog[] }
   */
  private async answerQuestions(page: Page, scenario: TestScenario, startQuestionNumber: number = 0, maxQuestions: number = 50): Promise<{ count: number; logs: QuestionLog[] }> {
    let questionCount = 0;
    const questionLogs: QuestionLog[] = [];

    console.log('      💬 質問への回答を開始...');

    // まず主訴入力ページかどうか確認
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    const initialUrl = page.url();

    if (initialUrl.includes('/main-complaint') || initialUrl.includes('/main-symptom')) {
      console.log(`      主訴入力ページを検出: ${scenario.complaints[0].text}`);

      // 主訴を入力フィールドに入力
      const complaintText = scenario.complaints[0].text;
      const inputSelector = 'input[type="text"], input[placeholder*="症状"], textarea';

      try {
        await page.locator(inputSelector).fill(complaintText);
        console.log(`      ✓ 主訴を入力: ${complaintText}`);

        // サジェストが表示されるのを待つ
        await page.waitForTimeout(1000);

        // サジェストから選択（「戻る」などを除外）
        const allButtons = await page.locator('button:visible').all();
        const excludeButtonText = ['前に戻る', '戻る', '意見を送る', 'skip to'];
        const suggestionButtons: { button: any; text: string }[] = [];

        for (const button of allButtons) {
          const text = await button.textContent();
          const trimmed = text?.trim() || '';
          const shouldExclude = excludeButtonText.some(pattern => trimmed.includes(pattern));

          if (!shouldExclude && trimmed.length > 0) {
            suggestionButtons.push({ button, text: trimmed });
          }
        }

        let selectedSuggestion = '';

        // 入力したテキストに近いものを選択
        for (const { button, text } of suggestionButtons) {
          if (text.includes(complaintText) || complaintText.includes(text)) {
            await button.click();
            selectedSuggestion = text;
            console.log(`      ✓ サジェストを選択: ${selectedSuggestion}`);
            break;
          }
        }

        // サジェストが見つからなかった場合は最初のボタンを選択
        if (!selectedSuggestion && suggestionButtons.length > 0) {
          const { button, text } = suggestionButtons[0];
          selectedSuggestion = text;
          await button.click();
          console.log(`      ✓ 最初のサジェストを選択: ${selectedSuggestion}`);
        }

        // 主訴選択をログ
        questionCount++;
        questionLogs.push({
          questionNumber: startQuestionNumber + questionCount,
          url: initialUrl.split('?')[0],
          questionText: '現在、最も気になる症状を教えてください。',
          availableOptions: suggestionButtons.slice(0, 10).map(b => b.text),
          selectedOption: selectedSuggestion,
          timestamp: Date.now(),
        });

        // URLが変わるまで待つ（確認ページへ遷移）
        await page.waitForURL(url => url.toString() !== initialUrl, { timeout: 10000 }).catch(() => {
          console.log(`      ⚠️  主訴選択後のページ遷移がタイムアウト`);
        });

        // 確認ページの処理
        await page.waitForLoadState('domcontentloaded');
        const confirmUrl = page.url();

        if (confirmUrl.includes('/confirm')) {
          console.log(`      確認ページを検出`);

          // 「次へ進む」ボタンをクリック
          await page.getByRole('button', { name: '次へ進む' }).click();
          console.log(`      ✓ 「次へ進む」をクリック`);

          // 確認ページをログ
          questionCount++;
          questionLogs.push({
            questionNumber: startQuestionNumber + questionCount,
            url: confirmUrl.split('?')[0],
            questionText: `【${selectedSuggestion}】に関する質問に進みます`,
            availableOptions: [],
            selectedOption: '次へ進む',
            timestamp: Date.now(),
          });

          // URLが変わるまで待つ（質問フローへ遷移）
          await page.waitForURL(url => url.toString() !== confirmUrl, { timeout: 10000 }).catch(() => {
            console.log(`      ⚠️  確認ページ後のページ遷移がタイムアウト`);
          });
        }
      } catch (error) {
        console.log(`      ⚠️  主訴入力でエラー: ${error}`);
      }
    }

    while (questionCount < maxQuestions) {
      // ページが完全にロードされるのを待機
      await page.waitForLoadState('domcontentloaded').catch(() => {});

      const currentUrl = page.url();
      console.log(`      [Q${questionCount + 1}] URL: ${currentUrl.split('?')[0]}`);

      // 結果/処理ページに到達したか確認
      if (currentUrl.includes('/qa/result') || currentUrl.includes('/qa/processing')) {
        console.log(`      ✅ 結果/処理ページに到達しました。質問を停止します`);
        break;
      }

      // 完了ページに到達したか確認 (ただし結果ページにはまだ到達していない可能性)
      // ただし、まだ質問ページにいる場合を除く (question-predicted-diseaseなど)
      if (currentUrl.includes('/qa/done') && !currentUrl.includes('/qa/question/')) {
        console.log(`      ⚠️  完了ページにいます - 結果が利用可能か確認中...`);
        // まだ抜けずに、goToResultにナビゲーションを処理させる
        break;
      }

      // 身長/体重ページを処理
      if (currentUrl.includes('/qa/height') || currentUrl.includes('/qa/weight') ||
          currentUrl.includes('/question/height') || currentUrl.includes('/question/weight')) {
        try {
          const previousUrl = currentUrl;

          // askmanスタイル: スライダーがある場合は操作が必要
          const slider = page.locator('input[type="range"]');
          const hasSlider = await slider.count().then(c => c > 0);

          if (hasSlider) {
            // スライダーを操作してデフォルト値を設定（ボタンを有効化）
            await slider.click();
            console.log(`      ✓ スライダーを操作しました`);
          }

          // 先に要素の存在を確認してから処理 (c-diagnosisスタイル)
          const nextButton = page.getByRole('button', { name: '次へ' });
          const hasNextButton = await nextButton.count().then(c => c > 0);

          if (hasNextButton) {
            // ボタンが有効になるまで少し待機（スライダー操作後）
            if (hasSlider) {
              await page.waitForTimeout(200);
            }
            await nextButton.click();
            await page.waitForURL(url => url.toString() !== previousUrl, { timeout: 3000 }).catch(() => {});
            if (page.url() !== previousUrl) {
              continue;
            }
          }

          // 先に要素の存在を確認してから処理 (askmanスタイル - skip button)
          const skipButton = page.getByRole('button', { name: 'skip to' });
          const hasSkipButton = await skipButton.count().then(c => c > 0);

          if (hasSkipButton) {
            await skipButton.click();
            await page.waitForURL(url => url.toString() !== previousUrl, { timeout: 3000 }).catch(() => {});
            continue;
          }

          console.log(`      ⚠️  身長/体重ページで次へ/スキップボタンが見つかりませんでした`);
          break;
        } catch (error) {
          console.log(`      ⚠️  ${currentUrl.includes('height') ? '身長' : '体重'}ページから進めませんでした: ${error}`);
          break;
        }
      }

      try {
        let clicked = false;
        let selectedOption: string | undefined;

        // 質問情報を収集
        const questionLog: QuestionLog = {
          questionNumber: startQuestionNumber + questionCount + 1,
          url: currentUrl.split('?')[0],
          availableOptions: [],
          timestamp: Date.now(),
        };

        // ページから質問文を抽出を試行
        try {
          // 一般的な質問パターンを探す (見出し、特定のテキストパターン)
          const questionTextElements = await page.locator('h1, h2, h3, [role="heading"]').all();
          for (const el of questionTextElements) {
            const text = await el.textContent();
            if (text && text.trim()) {
              const trimmedText = text.trim();
              // ナビゲーション/ブランディングテキストはスキップ、質問文は保持
              if (trimmedText === 'ユビー' ||
                  trimmedText === '症状検索エンジン「ユビー」' ||
                  trimmedText.startsWith('症状検索エンジン') ||
                  trimmedText === '戻る' ||
                  trimmedText.length < 3) {
                continue;
              }
              questionLog.questionText = trimmedText;
              break;
            }
          }
        } catch {}

        // 利用可能な選択肢を収集
        try {
          // まずボタンから選択肢を取得を試行
          const buttons = await page.locator('button:visible').all();
          for (const button of buttons) {
            const text = await button.textContent();
            if (text &&
                !text.includes('次へ') &&
                !text.includes('戻る') &&
                !text.includes('閉じる') &&
                !text.includes('skip to') &&
                !text.includes('意見を送る')) {
              questionLog.availableOptions.push(text.trim());
            }
          }

          // チェックボックス/ラジオラベルからも選択肢を取得を試行
          const checkboxes = await page.locator('input[type="checkbox"]:visible, input[type="radio"]:visible').all();
          for (const checkbox of checkboxes) {
            try {
              const id = await checkbox.getAttribute('id');
              if (id) {
                const label = page.locator(`label[for="${id}"]`);
                const labelText = await label.textContent();
                if (labelText && labelText.trim()) {
                  // 重複を回避
                  const trimmedLabel = labelText.trim();
                  if (!questionLog.availableOptions.includes(trimmedLabel)) {
                    questionLog.availableOptions.push(trimmedLabel);
                  }
                }
              }
            } catch {}
          }

          // スライダー/数値入力/日付ピッカーからも選択肢を取得
          const inputs = await page.locator('input:visible[type="range"], input:visible[type="number"], input:visible[type="date"], input:visible[type="text"]').all();
          if (inputs.length > 0) {
            for (const input of inputs) {
              const inputType = await input.getAttribute('type');
              const min = await input.getAttribute('min');
              const max = await input.getAttribute('max');

              if (inputType === 'range' || inputType === 'number') {
                const minNum = min ? parseInt(min) : 1;
                const maxNum = max ? parseInt(max) : 100;
                questionLog.availableOptions.push(`${minNum}-${maxNum}`);
              } else if (inputType === 'date') {
                questionLog.availableOptions.push('日付選択');
              } else if (inputType === 'text') {
                const placeholder = await input.getAttribute('placeholder');
                if (placeholder && (placeholder.includes('数') || placeholder.includes('年') || placeholder.includes('日'))) {
                  questionLog.availableOptions.push('数値入力');
                }
              }
            }
          }

          // SVGや画像ベースの選択肢（体の部位選択など）
          const svgElements = await page.locator('svg, canvas, img[usemap]').all();
          if (svgElements.length > 0 && questionLog.availableOptions.length === 0) {
            questionLog.availableOptions.push('クリック可能な領域（SVG/画像）');
          }
        } catch {}

        // 特別処理: サインアップ確認をスキップ
        if (currentUrl.includes('/confirm-signup') || questionLog.questionText?.includes('保存しておきたい')) {
          // 先に候補ボタンの存在を確認
          const skipSignupOptions = [
            'いいえ、結果を保存しなくてよい',
            'いいえ',
            '回答をとばす',
          ];

          for (const option of skipSignupOptions) {
            const button = page.getByRole('button', { name: option });
            const hasButton = await button.count().then(c => c > 0);

            if (hasButton) {
              await button.click();
              clicked = true;
              selectedOption = option;
              questionCount++;
              console.log(`      ✓ Skipped signup: ${option}`);
              break;
            }
          }
        }

        // 特別処理: 症状回答継続ページ - 常に「すぐに結果を見る」を選択
        if (!clicked && currentUrl.includes('/continue-symptom-answer')) {
          const seeResultsButton = page.getByRole('button', { name: 'ここまでの回答で結果を見る' });
          const hasButton = await seeResultsButton.count().then(c => c > 0);

          if (hasButton) {
            await seeResultsButton.click();
            clicked = true;
            selectedOption = 'ここまでの回答で結果を見る';
            questionCount++;
            console.log(`      ✓ Selected "ここまでの回答で結果を見る" to finish early`);
            break; // 結果に移動するため質問ループを抜ける
          }
        }

        // ボタン選択
        if (!clicked) {
          // ボタンが表示されるまで待機（ローディング完了）
          await page.waitForSelector('button:visible', { timeout: 10000 }).catch(() => {
            console.log(`      ⚠️  ボタンの表示を待機中にタイムアウト`);
          });

          const validButtons = await this.collectValidButtons(page);

          // 主訴/症状ページの特別処理
          if (currentUrl.includes('/main-complaint') || currentUrl.includes('/main-symptom')) {
            // シナリオで指定された主訴を選択を試行
            if (scenario.complaints && scenario.complaints.length > 0) {
              const targetComplaint = scenario.complaints[0].text;
              const complaintButton = validButtons.find(b => b.text === targetComplaint);

              if (complaintButton) {
                await complaintButton.button.click();
                clicked = true;
                selectedOption = complaintButton.text;
                questionCount++;
                console.log(`      ✓ ボタンをクリック: ${complaintButton.text.substring(0, 20)}`);
              }
            }
          }

          if (!clicked) {
            // チェックボックスページかどうか判定
            const checkboxes = await page.locator('input[type="checkbox"]:visible').all();
            const isCheckboxPage = checkboxes.length > 0;

            // question-16275のみ特別処理: c-diagnosisとaskmanで選択肢が異なるため安全な選択肢を優先
            const isQuestion16275 = currentUrl.includes('question-16275');

            if (isQuestion16275 && validButtons.length > 0) {
              const safeOptions = ['この中に該当なし', 'わからない', '回答をとばす'];
              const safeButton = validButtons.find(b => safeOptions.some(opt => b.text === opt));

              if (safeButton) {
                await safeButton.button.click();
                clicked = true;
                selectedOption = safeButton.text;
                questionCount++;
                console.log(`      ✓ [question-16275] 安全な選択肢をクリック: ${safeButton.text}`);
              } else {
                // 安全な選択肢がない場合はランダム選択
                const questionKey = questionLog.questionText || currentUrl;
                const randomIndex = this.getRandomIndexForQuestion(questionKey, validButtons.length);
                const selectedButton = validButtons[randomIndex];
                await selectedButton.button.click();
                clicked = true;
                selectedOption = selectedButton.text;
                questionCount++;
                console.log(`      ✓ [question-16275] ランダム選択 [${randomIndex + 1}/${validButtons.length}]: ${selectedButton.text.substring(0, 30)}`);
              }
            } else if (this.randomSeed !== null && validButtons.length > 0) {
              // チェックボックスページの場合は複数選択
              if (isCheckboxPage) {
                // 「回答をとばす」を除外してチェックボックス選択肢のみ取得
                const checkboxButtons = validButtons.filter(b => !b.text.includes('回答をとばす'));
                const skipButton = validButtons.find(b => b.text.includes('回答をとばす'));

                // 排他的選択肢を特定
                const exclusivePatterns = ['この中に該当なし', 'わからない', 'あてはまるものはない'];
                const exclusiveButtons = checkboxButtons.filter(b =>
                  exclusivePatterns.some(pattern => b.text.includes(pattern))
                );
                const nonExclusiveButtons = checkboxButtons.filter(b =>
                  !exclusivePatterns.some(pattern => b.text.includes(pattern))
                );

                // 「回答をとばす」をランダムで押すか判定（30%の確率）
                const questionKey = questionLog.questionText || currentUrl;
                const skipProbability = this.getRandomValueInRange(`${questionKey}_skip`, 0, 100);

                if (skipButton && skipProbability < 30) {
                  // 「回答をとばす」を押す
                  await skipButton.button.click();
                  clicked = true;
                  selectedOption = skipButton.text;
                  questionCount++;
                  console.log(`      ✓ 「回答をとばす」をクリック`);
                } else if (checkboxButtons.length > 0) {
                  // 排他的選択肢を選ぶか判定（40%の確率）
                  const exclusiveProbability = this.getRandomValueInRange(`${questionKey}_exclusive`, 0, 100);

                  if (exclusiveButtons.length > 0 && exclusiveProbability < 40) {
                    // 排他的選択肢から1つだけ選択
                    const randomIndex = this.getRandomValueInRange(`${questionKey}_exclusive_idx`, 0, exclusiveButtons.length - 1);
                    const selectedButton = exclusiveButtons[randomIndex];

                    await selectedButton.button.click();
                    clicked = true;
                    selectedOption = selectedButton.text;
                    questionCount++;
                    console.log(`      ✓ 排他的選択肢をクリック: ${selectedButton.text}`);
                  } else if (nonExclusiveButtons.length > 0) {
                    // 通常の選択肢から1〜複数個選択
                    const maxSelections = Math.min(3, nonExclusiveButtons.length); // 最大3個まで
                    const numSelections = this.getRandomValueInRange(`${questionKey}_count`, 1, maxSelections);

                    const selectedButtons: typeof nonExclusiveButtons = [];
                    const selectedTexts: string[] = [];

                    for (let i = 0; i < numSelections; i++) {
                      const availableButtons = nonExclusiveButtons.filter(b => !selectedButtons.includes(b));
                      if (availableButtons.length === 0) break;

                      const randomIndex = this.getRandomValueInRange(`${questionKey}_${i}`, 0, availableButtons.length - 1);
                      const selectedButton = availableButtons[randomIndex];
                      selectedButtons.push(selectedButton);
                      selectedTexts.push(selectedButton.text);

                      await selectedButton.button.click();
                      await page.waitForTimeout(200); // クリック間隔
                    }

                    clicked = true;
                    selectedOption = selectedTexts.join(', ');
                    questionCount++;
                    console.log(`      ✓ チェックボックス ${numSelections}個選択: ${selectedTexts.map(t => t.substring(0, 20)).join(', ')}`);
                  } else if (exclusiveButtons.length > 0) {
                    // 通常の選択肢がない場合は排他的選択肢から選ぶ
                    const randomIndex = this.getRandomValueInRange(`${questionKey}_exclusive_fallback`, 0, exclusiveButtons.length - 1);
                    const selectedButton = exclusiveButtons[randomIndex];

                    await selectedButton.button.click();
                    clicked = true;
                    selectedOption = selectedButton.text;
                    questionCount++;
                    console.log(`      ✓ 排他的選択肢をクリック: ${selectedButton.text}`);
                  }
                } else if (skipButton) {
                  // チェックボックスがない場合は「回答をとばす」
                  await skipButton.button.click();
                  clicked = true;
                  selectedOption = skipButton.text;
                  questionCount++;
                  console.log(`      ✓ 「回答をとばす」をクリック`);
                }
              } else {
                // 通常のボタン選択（1つだけ）
                const questionKey = questionLog.questionText || currentUrl;

                // 「回答をとばす」をランダムで押すか判定（20%の確率）
                const skipButton = validButtons.find(b => b.text.includes('回答をとばす'));
                const skipProbability = this.getRandomValueInRange(`${questionKey}_skip`, 0, 100);

                if (skipButton && skipProbability < 20) {
                  // 「回答をとばす」を押す
                  await skipButton.button.click();
                  clicked = true;
                  selectedOption = skipButton.text;
                  questionCount++;
                  console.log(`      ✓ 「回答をとばす」をクリック`);
                } else {
                  // 通常の選択肢からランダムに選択
                  const selectableButtons = validButtons.filter(b => !b.text.includes('回答をとばす'));
                  if (selectableButtons.length > 0) {
                    const randomIndex = this.getRandomIndexForQuestion(questionKey, selectableButtons.length);
                    const selectedButton = selectableButtons[randomIndex];
                    await selectedButton.button.click();
                    clicked = true;
                    selectedOption = selectedButton.text;
                    questionCount++;
                    console.log(`      ✓ 設問ベース要素をクリック [${randomIndex + 1}/${selectableButtons.length}]: ${selectedButton.text.substring(0, 30)}`);
                  } else if (skipButton) {
                    // 選択肢がない場合は「回答をとばす」
                    await skipButton.button.click();
                    clicked = true;
                    selectedOption = skipButton.text;
                    questionCount++;
                    console.log(`      ✓ 「回答をとばす」をクリック`);
                  }
                }
              }
            } else {
              // デフォルトモード: 「回答をとばす」ボタンがあるか確認
              const skipButton = validButtons.find(b => b.text.includes('回答をとばす'));
              if (skipButton) {
                await skipButton.button.click();
                clicked = true;
                selectedOption = skipButton.text;
                questionCount++;
                console.log(`      ✓ ボタンをクリック: ${skipButton.text.substring(0, 20)}`);
              } else if (validButtons.length > 0) {
                // スキップボタンがない場合、最後の選択肢をクリック (最下部の選択)
                const lastButton = validButtons[validButtons.length - 1];
                await lastButton.button.click();
                clicked = true;
                selectedOption = lastButton.text;
                questionCount++;
                console.log(`      ✓ ボタンをクリック (最後の選択肢): ${lastButton.text.substring(0, 20)}`);
              }
            }
          }
        }

        // 選択肢を選択した後 (または選択不要の場合)、「次へ」ボタンをクリックして進む
        if (clicked) {
          const previousUrl = currentUrl;
          try {
            // 「次へ」ボタンを探してクリックを試行
            const nextButton = page.locator('button:has-text("次へ"):visible, button:has-text("次へ進む"):visible').first();
            const isNextEnabled = await nextButton.isEnabled().catch(() => false);

            if (isNextEnabled) {
              await nextButton.click({ timeout: 2000 });
              console.log(`      ✓ 「次へ」ボタンをクリックして進みました`);
              // URL変更を待機（タイムアウトしても続行）
              await page.waitForURL(url => url.toString() !== previousUrl, { timeout: 2000 }).catch(() => {});
            }
          } catch (error) {
            // 「次へ」ボタンがない場合、選択自体がページを進めた可能性
          }
        }

        // まだボタンをクリックしていない場合、「次へ進む」または「次へ」を試行 (選択不要のページ用)
        if (!clicked) {
          const previousUrl = currentUrl;

          // 先に「次へ進む」ボタンの存在を確認
          const proceedButton = page.getByRole('button', { name: '次へ進む' });
          const hasProceedButton = await proceedButton.count().then(c => c > 0);

          if (hasProceedButton) {
            await proceedButton.click();
            clicked = true;
            selectedOption = '次へ進む';
            console.log(`      ✓ Clicked: 次へ進む`);
            await page.waitForURL(url => url.toString() !== previousUrl, { timeout: 2000 }).catch(() => {});
          } else {
            // 先に「次へ」ボタンの存在を確認
            const nextButton = page.getByRole('button', { name: '次へ' });
            const hasNextButton = await nextButton.count().then(c => c > 0);

            if (hasNextButton) {
              await nextButton.click();
              clicked = true;
              selectedOption = '次へ';
              console.log(`      ✓ Clicked: 次へ`);
              await page.waitForURL(url => url.toString() !== previousUrl, { timeout: 2000 }).catch(() => {});
            }
          }
        }

        if (!clicked) {
          console.log(`      ⚠️  クリック可能なボタンが見つかりません。停止します`);
          break;
        }

        // 選択した選択肢をログに追加して保存
        questionLog.selectedOption = selectedOption;
        questionLogs.push(questionLog);
      } catch (error) {
        console.log(`      ⚠️  質問 ${questionCount + 1} でエラー: ${error}`);
        break;
      }
    }

    console.log(`      ✅ ${questionCount}個の質問に回答しました`);
    return { count: questionCount, logs: questionLogs };
  }

  /**
   * Navigate to result page through UI flow (no direct navigation)
   * @returns Object with screenshot path (if failed) and question logs from extra questions
   */
  private async goToResult(page: Page, startQuestionNumber: number = 0): Promise<{ screenshot?: string; logs: QuestionLog[] }> {
    let currentUrl = page.url();
    const extraQuestionLogs: QuestionLog[] = [];
    let questionNumber = startQuestionNumber;

    console.log(`      📍 結果ページ遷移前のURL: ${currentUrl}`);

    // すでに結果ページにいるか確認
    if (currentUrl.includes('/qa/result') || currentUrl.includes('/qa/symptom-checker/result')) {
      console.log('      ✅ すでに結果ページにいます');
      await page.waitForSelector('text=読み込み中', { state: 'hidden', timeout: 30000 }).catch(() => {});
      return { logs: extraQuestionLogs };
    }

    // メインループ後に残っている質問ページを処理
    // (question-predicted-disease, symptom-care-needsなど)
    if (currentUrl.includes('/qa/question/')) {
      console.log('      📍 メインループ後に質問ページにいます, 残りの質問に回答中...');

      // 残りの質問に回答を試行 (最大40回)
      for (let i = 0; i < 40; i++) {
        // ページがロードされるのを待つ
        await page.waitForLoadState('domcontentloaded').catch(() => {});

        // ローディングアニメーションが消えるのを待つ
        await page.waitForSelector('text=読み込み中', { state: 'hidden', timeout: 5000 }).catch(() => {});

        await page.waitForTimeout(800);
        currentUrl = page.url();

        // 結果ページに到達したか確認
        if (currentUrl.includes('/qa/result') || currentUrl.includes('/qa/symptom-checker/result')) {
          console.log('      ✅ 結果ページに到達しました');
          await page.waitForSelector('text=読み込み中', { state: 'hidden', timeout: 30000 }).catch(() => {});
          return { logs: extraQuestionLogs };
        }

        // 完了/サインアップページに到達したか確認
        if (currentUrl.includes('/qa/done') || currentUrl.includes('/confirm-signup')) {
          console.log('      📍 完了/サインアップページに到達しました');
          break;
        }

        // もう質問ページではない
        if (!currentUrl.includes('/qa/question/')) {
          console.log('      📍 質問ページではなくなりました');
          break;
        }

        console.log(`      [Extra Q${i + 1}] URL: ${currentUrl.split('?')[0]}`);

        // 入力フィールドがあるか確認
        const inputFields = await page.locator('input[type="text"]:visible, input[type="number"]:visible, textarea:visible').all();
        if (inputFields.length > 0) {
          console.log(`      入力フィールドを検出 (${inputFields.length}個)`);

          // 入力フィールドに値を入力
          for (const input of inputFields) {
            const inputType = await input.getAttribute('type').catch(() => 'text');
            const placeholder = await input.getAttribute('placeholder').catch(() => '') || '';
            const inputMode = await input.getAttribute('inputmode').catch(() => '') || '';

            // 数値入力の判定: type="number", inputmode="numeric", またはplaceholderに数値関連のキーワード
            if (inputType === 'number' || inputMode === 'numeric' || placeholder.includes('数') || placeholder.includes('年') || placeholder.includes('日') || placeholder.includes('時間')) {
              // 数値入力の場合は1〜100の範囲でランダムな値を入力（0は避ける）
              const randomValue = Math.floor(Math.random() * 100) + 1;
              await input.fill(randomValue.toString());
              console.log(`      ✓ 数値入力: ${randomValue}`);
            } else {
              // テキスト入力の場合は「不明」を入力
              await input.fill('不明');
              console.log(`      ✓ テキスト入力: 不明`);
            }
          }

          // 入力後、少し待ってから次へボタンを探す
          await page.waitForTimeout(500);
        }

        // 決定論的選択のため設問文を抽出
        let questionText = '';
        try {
          const questionTextElements = await page.locator('h1, h2, h3, [role="heading"]').all();
          for (const el of questionTextElements) {
            const text = await el.textContent();
            if (text && text.trim()) {
              const trimmedText = text.trim();
              if (trimmedText !== 'ユビー' &&
                  trimmedText !== '症状検索エンジン「ユビー」' &&
                  !trimmedText.startsWith('症状検索エンジン') &&
                  trimmedText !== '戻る' &&
                  trimmedText.length >= 3) {
                questionText = trimmedText;
                break;
              }
            }
          }
        } catch {}

        const previousUrl = currentUrl;

        // Extra Questionsループ: 設問文に基づいて選択肢を選択
        if (this.randomSeed !== null) {
          // 特別処理: 症状回答継続ページ - 常に「すぐに結果を見る」を選択
          if (currentUrl.includes('/continue-symptom-answer')) {
            const seeResultsButton = page.getByRole('button', { name: 'ここまでの回答で結果を見る' });
            if (await seeResultsButton.count() > 0) {
              console.log(`      ✓ 「ここまでの回答で結果を見る」を選択して早期終了`);

              // ログに記録
              questionNumber++;
              extraQuestionLogs.push({
                questionNumber,
                url: currentUrl.split('?')[0],
                questionText: questionText || '',
                availableOptions: ['ここまでの回答で結果を見る', 'このまま回答を続ける'],
                selectedOption: 'ここまでの回答で結果を見る',
                timestamp: Date.now(),
              });

              await seeResultsButton.click();

              // ページ遷移を待つ
              await page.waitForURL(url => url.toString() !== previousUrl, { timeout: 5000 }).catch(() => {
                console.log(`      ⚠️  ページ遷移がタイムアウト`);
              });
              continue;
            }
          }

          const validButtons = await this.collectValidButtons(page);

          if (validButtons.length > 0) {
            // チェックボックスページかどうか判定
            const checkboxes = await page.locator('input[type="checkbox"]:visible').all();
            const isCheckboxPage = checkboxes.length > 0;

            // question-16275のみ特別処理: c-diagnosisとaskmanで選択肢が異なるため安全な選択肢を優先
            const isQuestion16275 = currentUrl.includes('question-16275');
            let selectedOption: string;

            if (isQuestion16275) {
              const safeOptions = ['この中に該当なし', 'わからない', '回答をとばす'];
              const safeButton = validButtons.find(b => safeOptions.some(opt => b.text === opt));

              if (safeButton) {
                selectedOption = safeButton.text;
                await safeButton.button.click();
                console.log(`      ✓ [question-16275] 安全な選択肢をクリック: ${safeButton.text}`);
              } else {
                const questionKey = questionText || currentUrl;
                const randomIndex = this.getRandomIndexForQuestion(questionKey, validButtons.length);
                const selectedButton = validButtons[randomIndex];
                selectedOption = selectedButton.text;
                await selectedButton.button.click();
                console.log(`      ✓ [question-16275] ランダム選択 "${selectedButton.text.substring(0, 30)}"`);
              }
            } else if (isCheckboxPage) {
              // チェックボックスページの場合は複数選択
              const checkboxButtons = validButtons.filter(b => !b.text.includes('回答をとばす'));
              const skipButton = validButtons.find(b => b.text.includes('回答をとばす'));

              // 排他的選択肢を特定
              const exclusivePatterns = ['この中に該当なし', 'わからない', 'あてはまるものはない'];
              const exclusiveButtons = checkboxButtons.filter(b =>
                exclusivePatterns.some(pattern => b.text.includes(pattern))
              );
              const nonExclusiveButtons = checkboxButtons.filter(b =>
                !exclusivePatterns.some(pattern => b.text.includes(pattern))
              );

              // 「回答をとばす」をランダムで押すか判定（30%の確率）
              const questionKey = questionText || currentUrl;
              const skipProbability = this.getRandomValueInRange(`${questionKey}_skip`, 0, 100);

              if (skipButton && skipProbability < 30) {
                // 「回答をとばす」を押す
                selectedOption = skipButton.text;
                await skipButton.button.click();
                console.log(`      ✓ 「回答をとばす」をクリック`);
              } else if (checkboxButtons.length > 0) {
                // 排他的選択肢を選ぶか判定（40%の確率）
                const exclusiveProbability = this.getRandomValueInRange(`${questionKey}_exclusive`, 0, 100);

                if (exclusiveButtons.length > 0 && exclusiveProbability < 40) {
                  // 排他的選択肢から1つだけ選択
                  const randomIndex = this.getRandomValueInRange(`${questionKey}_exclusive_idx`, 0, exclusiveButtons.length - 1);
                  const selectedButton = exclusiveButtons[randomIndex];

                  selectedOption = selectedButton.text;
                  await selectedButton.button.click();
                  console.log(`      ✓ 排他的選択肢をクリック: ${selectedButton.text}`);
                } else if (nonExclusiveButtons.length > 0) {
                  // 通常の選択肢から1〜複数個選択
                  const maxSelections = Math.min(3, nonExclusiveButtons.length);
                  const numSelections = this.getRandomValueInRange(`${questionKey}_count`, 1, maxSelections);

                  const selectedTexts: string[] = [];
                  const selectedButtons: typeof nonExclusiveButtons = [];

                  for (let i = 0; i < numSelections; i++) {
                    const availableButtons = nonExclusiveButtons.filter(b => !selectedButtons.includes(b));
                    if (availableButtons.length === 0) break;

                    const randomIndex = this.getRandomValueInRange(`${questionKey}_${i}`, 0, availableButtons.length - 1);
                    const selectedButton = availableButtons[randomIndex];
                    selectedButtons.push(selectedButton);
                    selectedTexts.push(selectedButton.text);

                    await selectedButton.button.click();
                    await page.waitForTimeout(200);
                  }

                  selectedOption = selectedTexts.join(', ');
                  console.log(`      ✓ チェックボックス ${numSelections}個選択: ${selectedTexts.map(t => t.substring(0, 20)).join(', ')}`);
                } else if (exclusiveButtons.length > 0) {
                  // 通常の選択肢がない場合は排他的選択肢から選ぶ
                  const randomIndex = this.getRandomValueInRange(`${questionKey}_exclusive_fallback`, 0, exclusiveButtons.length - 1);
                  const selectedButton = exclusiveButtons[randomIndex];

                  selectedOption = selectedButton.text;
                  await selectedButton.button.click();
                  console.log(`      ✓ 排他的選択肢をクリック: ${selectedButton.text}`);
                } else {
                  selectedOption = '';
                }
              } else if (skipButton) {
                selectedOption = skipButton.text;
                await skipButton.button.click();
                console.log(`      ✓ 「回答をとばす」をクリック`);
              } else {
                selectedOption = '';
              }
            } else {
              // 通常のボタン選択
              const questionKey = questionText || currentUrl;

              // 「回答をとばす」をランダムで押すか判定（20%の確率）
              const skipButton = validButtons.find(b => b.text.includes('回答をとばす'));
              const skipProbability = this.getRandomValueInRange(`${questionKey}_skip`, 0, 100);

              if (skipButton && skipProbability < 20) {
                selectedOption = skipButton.text;
                await skipButton.button.click();
                console.log(`      ✓ 「回答をとばす」をクリック`);
              } else {
                const selectableButtons = validButtons.filter(b => !b.text.includes('回答をとばす'));
                if (selectableButtons.length > 0) {
                  const randomIndex = this.getRandomIndexForQuestion(questionKey, selectableButtons.length);
                  const selectedButton = selectableButtons[randomIndex];
                  selectedOption = selectedButton.text;
                  await selectedButton.button.click();
                  console.log(`      ✓ ランダム: 要素をクリック "${selectedButton.text.substring(0, 30)}"`);
                } else if (skipButton) {
                  selectedOption = skipButton.text;
                  await skipButton.button.click();
                  console.log(`      ✓ 「回答をとばす」をクリック`);
                } else {
                  selectedOption = '';
                }
              }
            }

            // ログに記録
            questionNumber++;
            extraQuestionLogs.push({
              questionNumber,
              url: currentUrl.split('?')[0],
              questionText: questionText || '',
              availableOptions: validButtons.map(b => b.text),
              selectedOption: selectedOption,
              timestamp: Date.now(),
            });

            // チェックボックスのラベルをクリックした場合は「次へ」ボタンを押す必要がある
            // 「回答をとばす」ボタンをクリックした場合は不要
            if (isCheckboxPage && !selectedOption.includes('回答をとばす')) {
              // 「次へ」ボタンが有効になるまで待つ
              await page.waitForTimeout(500);
              const nextButton = page.getByRole('button', { name: '次へ' });

              try {
                await nextButton.waitFor({ state: 'visible', timeout: 2000 });
                const isDisabled = await nextButton.isDisabled();
                if (isDisabled) {
                  console.log(`      ⚠️  「次へ」ボタンが無効です。1秒待機します...`);
                  await page.waitForTimeout(1000);
                }
              } catch (error) {
                console.log(`      ⚠️  「次へ」ボタンの待機でエラー: ${error}`);
              }

              if (await nextButton.count() > 0) {
                await nextButton.first().click();
                console.log(`      ✓ 「次へ」ボタンをクリック`);
              }
            }

            // ページ遷移を待つ
            await page.waitForURL(url => url.toString() !== previousUrl, { timeout: 5000 }).catch(() => {
              console.log(`      ⚠️  ページ遷移がタイムアウト`);
            });
            continue;
          } else {
            // ボタンが見つからない場合、スライダーや入力フィールドを検出
            const inputs = await page.locator('input:visible[type="range"], input:visible[type="number"], input:visible[type="date"], input:visible[type="text"]').all();

            if (inputs.length > 0) {
              console.log(`      入力フィールドを検出 (${inputs.length}個)`);

              const availableOptions: string[] = [];
              let selectedValue = '';

              for (const input of inputs) {
                const inputType = await input.getAttribute('type');
                const inputValue = await input.getAttribute('value');
                const min = await input.getAttribute('min');
                const max = await input.getAttribute('max');

                if (inputType === 'range' || inputType === 'number') {
                  // スライダーまたは数値入力の場合
                  const minNum = min ? parseInt(min) : 1;
                  const maxNum = max ? parseInt(max) : 100;
                  const questionKey = `${questionText}_${currentUrl}_slider`;
                  const randomValue = this.getRandomValueInRange(questionKey, minNum, maxNum);

                  await input.fill(randomValue.toString());
                  availableOptions.push(`${minNum}-${maxNum}`);
                  selectedValue = randomValue.toString();
                  console.log(`      ✓ スライダー/数値入力: ${randomValue} (範囲: ${minNum}-${maxNum})`);
                } else if (inputType === 'date') {
                  // 日付入力の場合
                  const questionKey = `${questionText}_${currentUrl}_date`;
                  const daysAgo = this.getRandomValueInRange(questionKey, 1, 30);
                  const date = new Date();
                  date.setDate(date.getDate() - daysAgo);
                  const dateStr = date.toISOString().split('T')[0];

                  await input.fill(dateStr);
                  availableOptions.push('日付選択');
                  selectedValue = `${daysAgo}日前`;
                  console.log(`      ✓ 日付入力: ${dateStr} (${daysAgo}日前)`);
                } else if (inputType === 'text') {
                  // テキスト入力の場合（数値のみ受け付ける可能性がある）
                  const placeholder = await input.getAttribute('placeholder');
                  if (placeholder && (placeholder.includes('数') || placeholder.includes('年') || placeholder.includes('日'))) {
                    const questionKey = `${questionText}_${currentUrl}_text_number`;
                    const randomValue = this.getRandomValueInRange(questionKey, 1, 100);
                    await input.fill(randomValue.toString());
                    availableOptions.push('数値入力');
                    selectedValue = randomValue.toString();
                    console.log(`      ✓ 数値テキスト入力: ${randomValue}`);
                  }
                }
              }

              // 「回答をとばす」ボタンがあるか確認
              const skipButton = page.getByRole('button', { name: '回答をとばす' });
              if (await skipButton.isVisible({ timeout: 500 }).catch(() => false)) {
                availableOptions.push('回答をとばす');
              }

              // ログに記録
              questionNumber++;
              extraQuestionLogs.push({
                questionNumber,
                url: currentUrl.split('?')[0],
                questionText: questionText || '',
                availableOptions: availableOptions.length > 0 ? availableOptions : ['入力フィールド'],
                selectedOption: selectedValue || '入力',
                timestamp: Date.now(),
              });

              // 「次へ」ボタンをクリック
              await page.waitForTimeout(500);
              const nextButton = page.getByRole('button', { name: '次へ' });

              if (await nextButton.count() > 0) {
                await nextButton.first().click();
                console.log(`      ✓ 「次へ」ボタンをクリック`);

                // ページ遷移を待つ
                await page.waitForURL(url => url.toString() !== previousUrl, { timeout: 5000 }).catch(() => {
                  console.log(`      ⚠️  ページ遷移がタイムアウト`);
                });
                continue;
              }
            }

            // SVGや画像ベースの選択肢を探す（体の部位選択など）
            const svgElements = await page.locator('svg, canvas, img[usemap]').all();
            if (svgElements.length > 0) {
              console.log(`      SVG/画像ベースの選択要素を検出 (${svgElements.length}個)`);

              // 「回答をとばす」ボタンがあるか確認
              const skipButton = page.getByRole('button', { name: '回答をとばす' });
              const hasSkipButton = await skipButton.isVisible({ timeout: 500 }).catch(() => false);

              // ログに記録（選択肢は「クリック可能な領域」として記録）
              questionNumber++;
              extraQuestionLogs.push({
                questionNumber,
                url: currentUrl.split('?')[0],
                questionText: questionText || '',
                availableOptions: hasSkipButton ? ['クリック可能な領域（SVG/画像）', '回答をとばす'] : ['クリック可能な領域（SVG/画像）'],
                selectedOption: '回答をとばす',
                timestamp: Date.now(),
              });

              // 「回答をとばす」をクリック
              if (hasSkipButton) {
                await skipButton.click();
                console.log(`      ✓ 「回答をとばす」をクリック`);

                // ページ遷移を待つ
                await page.waitForURL(url => url.toString() !== previousUrl, { timeout: 5000 }).catch(() => {
                  console.log(`      ⚠️  ページ遷移がタイムアウト`);
                });
                continue;
              }
            }

            console.log('      ⚠️  有効なクリック可能な要素が見つかりませんでした');
            break;
          }
        }


        // 表示されているボタンをクリックを試行 (最後の手段)
        const buttons = await page.locator('button:visible, a:visible').all();
        let clicked = false;

        for (const button of buttons) {
          const text = await button.textContent();
          if (text &&
              !text.includes('戻る') &&
              !text.includes('閉じる') &&
              !text.includes('意見を送る') &&
              !text.includes('skip to') &&
              !text.includes('signup') &&
              !text.includes('result')) {
            console.log(`      ✓ ボタン/リンクをクリック中: ${text.substring(0, 20)}`);
            await button.click();
            clicked = true;

            // ページ遷移を待つ
            await page.waitForURL(url => url.toString() !== previousUrl, { timeout: 5000 }).catch(() => {
              console.log(`      ⚠️  ページ遷移がタイムアウト`);
            });
            break;
          }
        }

        if (!clicked) {
          console.log('      ⚠️  クリック可能なボタンが見つかりませんでした');
          break;
        }
      }

      currentUrl = page.url();
      console.log(`      📍 URL after extra questions: ${currentUrl}`);
    }

    // ナビゲーション完了を待機
    currentUrl = page.url();
    console.log(`      📍 現在のURL: ${currentUrl}`);

    // サインアップ確認ページを処理
    if (currentUrl.includes('/confirm-signup')) {
      console.log('      📍 サインアップ確認ページにいます。サインアップをスキップ中...');

      const skipOptions = ['いいえ、結果を保存しなくてよい', 'いいえ'];
      let clicked = false;

      for (const option of skipOptions) {
        const button = page.getByRole('button', { name: option });
        if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log(`      ✓ Clicking "${option}"`);
          await button.click();
          clicked = true;
          await page.waitForTimeout(1000);
          break;
        }
      }

      if (clicked) {
        currentUrl = page.url();
        console.log(`      📍 URL after skipping signup: ${currentUrl}`);
      }
    }

    // 完了ページにいる場合、ナビゲーションボタンを探す
    if (currentUrl.includes('/done')) {
      console.log('      📍 完了ページにいます。ナビゲーションボタンを探しています...');

      // 複数のボタン名を試行
      const buttonOptions = [
        '次へ',
        '結果を見る',
        '確認',
        '診断結果を見る',
      ];

      let buttonClicked = false;
      for (const buttonName of buttonOptions) {
        const button = page.getByRole('button', { name: buttonName });
        const isVisible = await button.isVisible({ timeout: 2000 }).catch(() => false);
        if (isVisible) {
          console.log(`      ✓ "${buttonName}"ボタンが見つかりました。クリック中...`);
          await button.click();
          buttonClicked = true;
          await page.waitForTimeout(1000);

          // 結果ページへのURLの変更を待機
          for (let i = 0; i < 60; i++) {
            await page.waitForTimeout(1000);
            currentUrl = page.url();
            console.log(`      クリック後のURLを確認中 (${i + 1}/60): ${currentUrl}`);

            if (currentUrl.includes('/qa/result') || currentUrl.includes('/qa/symptom-checker/result')) {
              console.log(`      ✅ "${buttonName}"ボタン経由で結果ページに到達`);
              await page.waitForSelector('text=読み込み中', { state: 'hidden', timeout: 30000 }).catch(() => {});

              console.log(`      ✅ 最終URL: ${currentUrl}`);
              return { logs: extraQuestionLogs };  // 結果ページに正常に到達
            }

            // 処理ページで停止しているか確認
            if (currentUrl.includes('/processing')) {
              console.log('      ⏳ 処理ページにいます。待機を継続中...');
            }
          }

          console.log('      ⚠️  120秒経過しても結果ページにURLが変わりませんでした');
          break;
        }
      }

      if (!buttonClicked) {
        console.log('      ⚠️  完了ページでナビゲーションボタンが見つかりませんでした');
        console.log(`      📸 デバッグ用スクリーンショットを撮影中...`);
        const screenshotPath = `./reports/debug_done_page_${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`      📸 スクリーンショット保存: ${screenshotPath}`);
      }
    }

    // 最終チェック
    currentUrl = page.url();
    if (currentUrl.includes('/qa/result') || currentUrl.includes('/qa/symptom-checker/result')) {
      console.log(`      ✅ 結果ページに正常に到達: ${currentUrl}`);
      return { logs: extraQuestionLogs };  // 結果ページに正常に到達
    } else {
      console.log(`      ❌ ERROR: 結果ページに到達できませんでした。 Final URL: ${currentUrl}`);
      console.log(`      📸 デバッグ用スクリーンショットを撮影中...`);
      const screenshotPath = `./screenshots/failed_to_reach_result_${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`      📸 スクリーンショット保存: ${screenshotPath}`);
      throw new Error(`結果ページに到達できませんでした。 停止位置: ${currentUrl}. Screenshot: ${screenshotPath}`);
    }
  }

  /**
   * ヘルパー: 先行する見出しに基づいて疾患ボタンがどのセクションに属するかを判定
   */
  private async getDiseaseSection(page: Page, button: any): Promise<'related' | 'easily-missed' | undefined> {
    try {
      // ページ上のボタンの位置を取得
      const buttonBox = await button.boundingBox();
      if (!buttonBox) return undefined;

      // このボタンの上に「回答に関連する病気」見出しが存在するか確認
      const relatedHeading = page.locator('text=回答に関連する病気').first();
      const relatedExists = await relatedHeading.isVisible({ timeout: 500 }).catch(() => false);

      // このボタンの上に「見逃されやすい病気」見出しが存在するか確認
      const missedHeading = page.locator('text=見逃されやすい病気').first();
      const missedExists = await missedHeading.isVisible({ timeout: 500 }).catch(() => false);

      if (!relatedExists && !missedExists) {
        return undefined;
      }

      const relatedBox = relatedExists ? await relatedHeading.boundingBox() : null;
      const missedBox = missedExists ? await missedHeading.boundingBox() : null;

      // このボタンの上で最も近い見出しを見つける
      if (relatedBox && missedBox) {
        // 両方の見出しが存在 - どちらが上に近いか確認
        if (relatedBox.y < buttonBox.y && missedBox.y < buttonBox.y) {
          // 両方とも上にある - より近い方を選択 (高いy値)
          return relatedBox.y > missedBox.y ? 'related' : 'easily-missed';
        } else if (relatedBox.y < buttonBox.y) {
          return 'related';
        } else if (missedBox.y < buttonBox.y) {
          return 'easily-missed';
        }
      } else if (relatedBox && relatedBox.y < buttonBox.y) {
        return 'related';
      } else if (missedBox && missedBox.y < buttonBox.y) {
        return 'easily-missed';
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * 結果ページから疾患結果を抽出
   */
  private async getDiseaseResults(page: Page): Promise<DiseaseResult[]> {
    const currentUrl = page.url();
    console.log(`      🔍 疾患情報を抽出中: ${currentUrl}`);

    // スクレイピングを試行する前に結果ページにいることを確認
    if (!currentUrl.includes('/qa/result') && !currentUrl.includes('/qa/symptom-checker/result')) {
      console.log(`      ⚠️  警告: 結果ページではありません! 現在のURL: ${currentUrl}`);
      console.log(`      ⚠️  不正確なデータのキャプチャを避けるため疾患スクレイピングをスキップします`);

      // デバッグ用にスクリーンショットを撮影
      console.log(`      📸 不正なページのスクリーンショットを撮影中...`);
      const screenshotPath = `./screenshots/wrong_page_for_scraping_${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`      📸 スクリーンショット保存: ${screenshotPath}`);

      return [];
    }

    // ページが完全にロードされるまで待機
    await page.waitForTimeout(1500);

    // 疾患セクションが存在するか確認
    const hasDiseaseSection = await page.locator('text=回答に関連する病気').isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasDiseaseSection) {
      console.log(`      ⚠️  警告: ページ上に疾患セクションが見つかりません!`);
      console.log(`      ⚠️  これは有効な結果ページではない可能性があります`);
      return [];
    }

    console.log(`      ✅ 疾患セクションが正常にロードされました`);

    // すべての疾患を表示するため全ての「もっと見る」ボタンをクリック
    try {
      const moreButtons = await page.getByRole('button', { name: 'もっと見る' }).all();
      if (moreButtons.length > 0) {
        console.log(`      📋 「もっと見る」ボタンを${moreButtons.length}個発見`);
        for (let i = 0; i < moreButtons.length; i++) {
          try {
            if (await moreButtons[i].isVisible({ timeout: 1000 })) {
              console.log(`      📋 「もっと見る」ボタンをクリック中 ${i + 1}/${moreButtons.length}...`);
              await moreButtons[i].click();
              await page.waitForTimeout(800);
            }
          } catch (e) {
            console.log(`      ⚠️  ボタン${i + 1}をクリックできませんでした: ${e}`);
          }
        }
        console.log(`      ✓ すべての疾患リストを展開しました`);
      } else {
        console.log(`      ℹ️  「もっと見る」ボタンが見つかりません (全ての疾患が既に表示されている可能性)`);
      }
    } catch (error) {
      console.log(`      ⚠️  「もっと見る」ボタンのクリック中にエラー: ${error}`);
    }

    const diseases: DiseaseResult[] = [];

    // ページ上の全ての疾患ボタンを取得
    const allDiseaseButtons = await page.locator('button[id^="GTM-disease_card_"]').all();
    console.log(`      📋 疾患ボタンを合計${allDiseaseButtons.length}個発見`);

    // 各ボタンについて、どのセクションに属するか判定
    for (const button of allDiseaseButtons) {
      try {
        const text = await button.textContent();
        if (text && text.trim()) {
          const fullText = text.trim();
          const section = await this.getDiseaseSection(page, button);

          // ラベルと病名を分離
          // 例: "指定難病と関連ありクッシング症候群" → label: "指定難病と関連あり", name: "クッシング症候群"
          // 例: "指定難病全身性エリテマトーデス" → label: "指定難病", name: "全身性エリテマトーデス"
          let label: string | undefined;
          let name = fullText;

          // よくあるラベルパターンをチェック
          const labelPatterns = [
            { pattern: /^指定難病と関連あり(.+)$/, label: '指定難病と関連あり' },
            { pattern: /^指定難病(.+)$/, label: '指定難病' },
          ];

          for (const { pattern, label: labelText } of labelPatterns) {
            const match = fullText.match(pattern);
            if (match) {
              label = labelText;
              name = match[1];
              break;
            }
          }

          diseases.push({
            id: name.replace(/\s+/g, '_'),
            name,
            label,
            section,
          });
        }
      } catch (error) {
        console.log(`      ⚠️  ボタン処理中にエラー: ${error}`);
      }
    }

    // ログ用にセクション別にカウント
    const relatedCount = diseases.filter(d => d.section === 'related').length;
    const missedCount = diseases.filter(d => d.section === 'easily-missed').length;
    const unknownCount = diseases.filter(d => !d.section).length;

    console.log(`      📊 発見された疾患の合計: ${diseases.length}`);
    console.log(`      📊   - 関連する疾患: ${relatedCount}`);
    console.log(`      📊   - 見逃されやすい疾患: ${missedCount}`);
    if (unknownCount > 0) {
      console.log(`      📊   - 不明なセクション: ${unknownCount}`);
    }

    return diseases;
  }

  /**
   * LocalStorageスナップショットを取得
   */
  private async getLocalStorageSnapshot(page: Page): Promise<any> {
    console.log(`      📦 LocalStorage取得中...`);

    const snapshot = await page.evaluate(() => {
      const userInfoValue = localStorage.getItem('user-info');
      const medicoUserValue = localStorage.getItem('medico-user');

      return {
        userInfo: userInfoValue ? JSON.parse(userInfoValue) : null,
        medicoUser: medicoUserValue ? JSON.parse(medicoUserValue) : null,
      };
    });

    console.log(`      ✓ LocalStorage取得完了`);
    return snapshot;
  }

  /**
   * 成功時に結果画面のスクリーンショットを撮影
   */
  private async takeSuccessScreenshot(page: Page, outputDir?: string): Promise<string> {
    console.log(`      📸 結果画面のスクリーンショット撮影中...`);

    const fileName = `${this.engine}-result.png`;
    const screenshotPath = outputDir ? `${outputDir}/${fileName}` : `screenshots/${fileName}`;

    await page.screenshot({ path: screenshotPath, fullPage: true });

    console.log(`      ✓ スクリーンショット保存: ${screenshotPath}`);
    return screenshotPath;
  }
}
