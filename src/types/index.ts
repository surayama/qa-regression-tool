// User Information
export interface UserInfo {
  age: number;
  ageMonth?: number;
  sex: 'male' | 'female';
  relationship: 'myself' | 'family' | 'other';
  hasPhysicalData?: boolean;
  physicalData?: {
    height?: number;
    weight?: number;
    bloodPressure?: {
      systolic: number;
      diastolic: number;
    };
  };
}

// Complaint/Chief Complaint
export interface Complaint {
  id: string;
  text: string;
}

// Answer types
export type Answer =
  | { type: 'SingleChoiceAnswer'; choiceId: string }
  | { type: 'MultipleChoiceAnswer'; choiceIds: string[] }
  | { type: 'NumericAnswer'; value: number }
  | { type: 'TextAnswer'; text: string }
  | { type: 'SkipAnswer' };

// Question with Answer pair
export interface QuestionAnswer {
  questionId: string;
  answer: Answer;
}

// Test Scenario
export interface TestScenario {
  name: string;
  description?: string;
  user: UserInfo;
  complaints: Complaint[];
  answers: QuestionAnswer[];
}

// Disease Result
export interface DiseaseResult {
  id: string;
  name: string;
  label?: string;  // Disease label like "指定難病と関連あり", "指定難病"
  probability?: number;
  section?: 'related' | 'easily-missed';  // Which section the disease appeared in
}

// Result Page Elements - 結果画面の検出要素
export interface ResultPageElements {
  // 疾患カード
  diseases: DiseaseResult[];

  // バナー
  banners?: {
    membershipPlus?: boolean;  // 会員登録バナーの有無
    appDownload?: boolean;     // アプリダウンロードバナーの有無
    ads?: string[];            // 広告バナーのURL一覧
  };

  // ボタン・機能
  buttons?: {
    hospitalSearch?: boolean;  // 病院検索ボタンの有無
    ubieActions?: string[];    // ユビー機能ボタン一覧
  };

  // セクション
  sections?: {
    otc?: boolean;             // 市販薬セクションの有無
    relatedDiseases?: boolean; // 関連疾患セクションの有無
    treatmentInfo?: boolean;   // 治療情報セクションの有無
  };

  // SNS共有
  social?: {
    twitter?: boolean;         // Twitter共有ボタンの有無
    line?: boolean;            // LINE共有ボタンの有無
  };
}

// Question Log - detailed information about each question answered
export interface QuestionLog {
  questionNumber: number;
  url: string;
  questionText?: string;  // The question displayed to the user
  availableOptions: string[];  // All available choices
  selectedOption?: string;  // What was selected
  timestamp: number;
}

// Test Result
export interface TestResult {
  scenario: TestScenario;
  diseases: DiseaseResult[];
  resultPageElements?: ResultPageElements;  // 結果画面の詳細要素
  questionCount: number;
  executionTimeMs: number;
  questionLogs?: QuestionLog[];  // Detailed log of each question
  error?: string;
  screenshotPath?: string;  // Path to error screenshot if error occurred
}

// Comparison Result
export interface ComparisonResult {
  passed: boolean;
  cDiagnosisResult: TestResult;
  askmanResult: TestResult;
  differences: {
    diseaseMismatch?: {
      cDiagnosisOnly: DiseaseResult[];
      askmanOnly: DiseaseResult[];
      orderMismatch?: boolean;
    };
    questionCountMismatch?: {
      cDiagnosis: number;
      askman: number;
    };
    resultPageElementsMismatch?: {
      banners?: Record<string, any>;
      buttons?: Record<string, any>;
      sections?: Record<string, any>;
      social?: Record<string, any>;
    };
  };
}
