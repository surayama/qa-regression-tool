import fs from 'fs';
import path from 'path';
import { ComparisonResult } from '../types';

export class ReportWriter {
  private reportDir: string;

  constructor(reportDir: string = 'reports') {
    this.reportDir = reportDir;

    // Create reports directory if it doesn't exist
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  /**
   * Format date in JST (Japan Standard Time)
   * Returns: YYYYMMDD_HHMMSS format
   */
  private getJSTTimestamp(): string {
    const now = new Date();

    // Convert to JST (UTC+9)
    const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000));

    const year = jstDate.getUTCFullYear();
    const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(jstDate.getUTCDate()).padStart(2, '0');
    const hours = String(jstDate.getUTCHours()).padStart(2, '0');
    const minutes = String(jstDate.getUTCMinutes()).padStart(2, '0');
    const seconds = String(jstDate.getUTCSeconds()).padStart(2, '0');

    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
  }

  /**
   * Get ISO format timestamp in JST
   */
  private getJSTISOString(): string {
    const now = new Date();
    const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000));

    const year = jstDate.getUTCFullYear();
    const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(jstDate.getUTCDate()).padStart(2, '0');
    const hours = String(jstDate.getUTCHours()).padStart(2, '0');
    const minutes = String(jstDate.getUTCMinutes()).padStart(2, '0');
    const seconds = String(jstDate.getUTCSeconds()).padStart(2, '0');
    const ms = String(jstDate.getUTCMilliseconds()).padStart(3, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}+09:00`;
  }

  /**
   * Save comparison report to file
   * Returns the path to the saved report
   */
  async saveReport(result: ComparisonResult, formattedReport: string): Promise<string> {
    // If outputDir is specified in result, use it; otherwise use default reportDir
    const targetDir = result.outputDir || this.reportDir;

    const filename = `report.txt`;
    const filepath = path.join(targetDir, filename);

    // Write report to file
    fs.writeFileSync(filepath, formattedReport, 'utf-8');

    return filepath;
  }

  /**
   * Save comparison report as JSON
   */
  async saveReportJSON(result: ComparisonResult): Promise<string> {
    // If outputDir is specified in result, use it; otherwise use default reportDir
    const targetDir = result.outputDir || this.reportDir;

    const filename = `report.json`;
    const filepath = path.join(targetDir, filename);

    // Convert result to JSON (exclude scenario to avoid duplication)
    const jsonData = {
      timestamp: this.getJSTISOString(),
      scenarioName: result.cDiagnosisResult.scenario.name,
      passed: result.passed,
      summary: {
        cDiagnosis: {
          questionCount: result.cDiagnosisResult.questionCount,
          diseaseCount: result.cDiagnosisResult.diseases.length,
          executionTimeMs: result.cDiagnosisResult.executionTimeMs,
        },
        askman: {
          questionCount: result.askmanResult.questionCount,
          diseaseCount: result.askmanResult.diseases.length,
          executionTimeMs: result.askmanResult.executionTimeMs,
        },
      },
      diseases: {
        cDiagnosis: result.cDiagnosisResult.diseases,
        askman: result.askmanResult.diseases,
      },
      questionLogs: {
        cDiagnosis: result.cDiagnosisResult.questionLogs || [],
        askman: result.askmanResult.questionLogs || [],
      },
      differences: result.differences,
    };

    fs.writeFileSync(filepath, JSON.stringify(jsonData, null, 2), 'utf-8');

    return filepath;
  }

  /**
   * List all reports in the reports directory
   */
  async listReports(): Promise<string[]> {
    if (!fs.existsSync(this.reportDir)) {
      return [];
    }

    const files = fs.readdirSync(this.reportDir);
    return files
      .filter(f => f.endsWith('.txt') || f.endsWith('.json'))
      .sort()
      .reverse(); // Most recent first
  }
}
