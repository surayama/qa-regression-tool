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

// Question Log - detailed information about each question answered
export interface QuestionLog {
  questionNumber: number;
  url: string;
  questionText?: string;  // The question displayed to the user
  availableOptions: string[];  // All available choices
  selectedOption?: string;  // What was selected
  timestamp: number;
}

// LocalStorage snapshot
export interface LocalStorageSnapshot {
  userInfo?: {
    relationship?: string;
    age?: number;
    sex?: string;
  };
  medicoUser?: {
    medicoUser?: {
      id?: string;
      age?: number | null;
      sex?: string | null;
      relationship?: string;
    };
    authProvider?: string;
  };
}

// Test Result
export interface TestResult {
  scenario: TestScenario;
  diseases: DiseaseResult[];
  questionCount: number;
  executionTimeMs: number;
  questionLogs?: QuestionLog[];  // Detailed log of each question
  localStorageSnapshot?: LocalStorageSnapshot;  // LocalStorage values after questionnaire
  error?: string;
  screenshotPath?: string;  // Path to error screenshot if error occurred
}

// Comparison Result
export interface ComparisonResult {
  passed: boolean;
  cDiagnosisResult: TestResult;
  askmanResult: TestResult;
  outputDir?: string;  // Output directory for this test result
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
  };
}
