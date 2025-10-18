import { TestResult, ComparisonResult, DiseaseResult } from '../types';

export class ComparisonEngine {
  /**
   * Compare c-diagnosis and askman results
   */
  compare(cDiagnosisResult: TestResult, askmanResult: TestResult): ComparisonResult {
    const differences: ComparisonResult['differences'] = {};
    let passed = true;

    // Compare disease lists
    const diseaseMismatch = this.compareDiseases(
      cDiagnosisResult.diseases,
      askmanResult.diseases
    );
    if (diseaseMismatch) {
      differences.diseaseMismatch = diseaseMismatch;
      passed = false;
    }

    // Compare question counts
    if (cDiagnosisResult.questionCount !== askmanResult.questionCount) {
      differences.questionCountMismatch = {
        cDiagnosis: cDiagnosisResult.questionCount,
        askman: askmanResult.questionCount,
      };
      passed = false;
    }

    return {
      passed,
      cDiagnosisResult,
      askmanResult,
      differences,
    };
  }

  /**
   * Match questions between c-diagnosis and askman based on question ID
   * Returns a list that maintains order while matching same questions
   */
  private matchQuestions(
    cLogs: any[],
    aLogs: any[]
  ): Array<{ cLog?: any; aLog?: any }> {
    const result: Array<{ cLog?: any; aLog?: any }> = [];
    let ci = 0;
    let ai = 0;

    while (ci < cLogs.length || ai < aLogs.length) {
      const cLog = cLogs[ci];
      const aLog = aLogs[ai];

      // If both exist, try to match by question text first, then by question ID
      if (cLog && aLog) {
        // First try matching by question text (if both have question text)
        const cText = cLog.questionText?.trim();
        const aText = aLog.questionText?.trim();
        const textMatch = cText && aText && cText === aText;

        // Fallback to URL-based matching if no question text match
        const cId = this.extractQuestionId(cLog.url);
        const aId = this.extractQuestionId(aLog.url);

        if (textMatch || cId === aId) {
          // Same question - pair them
          result.push({ cLog, aLog });
          ci++;
          ai++;
        } else {
          // Different questions - look ahead to find a match
          let foundMatch = false;

          // Look ahead in askman logs to find matching question
          for (let j = ai + 1; j < aLogs.length; j++) {
            const futureALog = aLogs[j];
            const futureAText = futureALog.questionText?.trim();
            const futureAId = this.extractQuestionId(futureALog.url);
            const futureTextMatch = cText && futureAText && cText === futureAText;

            if (futureTextMatch || cId === futureAId) {
              // Found matching question later in askman - output askman-only questions first
              result.push({ cLog: undefined, aLog });
              ai++;
              foundMatch = true;
              break;
            }
          }

          if (!foundMatch) {
            // Look ahead in c-diagnosis logs to find matching question
            for (let j = ci + 1; j < cLogs.length; j++) {
              const futureCLog = cLogs[j];
              const futureCText = futureCLog.questionText?.trim();
              const futureCId = this.extractQuestionId(futureCLog.url);
              const futureTextMatch = aText && futureCText && aText === futureCText;

              if (futureTextMatch || aId === futureCId) {
                // Found matching question later in c-diagnosis - output c-diagnosis-only questions first
                result.push({ cLog, aLog: undefined });
                ci++;
                foundMatch = true;
                break;
              }
            }
          }

          if (!foundMatch) {
            // No match found in either direction - use priority to decide
            const cIndex = this.getQuestionPriority(cId);
            const aIndex = this.getQuestionPriority(aId);

            if (cIndex <= aIndex) {
              result.push({ cLog, aLog: undefined });
              ci++;
            } else {
              result.push({ cLog: undefined, aLog });
              ai++;
            }
          }
        }
      } else if (cLog) {
        // Only C-Diagnosis has questions left
        result.push({ cLog, aLog: undefined });
        ci++;
      } else if (aLog) {
        // Only Askman has questions left
        result.push({ cLog: undefined, aLog });
        ai++;
      }
    }

    return result;
  }

  /**
   * Extract question ID from URL
   */
  private extractQuestionId(url: string): string {
    const parts = url.split('/');
    let lastPart = parts[parts.length - 1].split('?')[0];

    // Normalize similar question types
    lastPart = lastPart.replace('main-symptom', 'main-complaint');
    lastPart = lastPart.replace('relationship', 'person');

    // Handle both /qa/age and /qa/question/age formats
    // Remove "question-" prefix if it exists to match shorter URLs
    if (lastPart === 'age' || lastPart === 'sex' || lastPart === 'height' || lastPart === 'weight') {
      // These are the same regardless of /qa/X or /qa/question/X format
      return lastPart;
    }

    return lastPart;
  }

  /**
   * Get priority order for questions (lower = earlier in flow)
   */
  private getQuestionPriority(questionId: string): number {
    // Basic info questions come first
    if (questionId.includes('age') || questionId.includes('person')) return 1;
    if (questionId.includes('sex')) return 2;
    if (questionId.includes('height')) return 3;
    if (questionId.includes('weight')) return 4;
    if (questionId.includes('main-complaint')) return 5;

    // Extract numeric part for question-XXXXX
    const match = questionId.match(/question-(\d+)/);
    if (match) {
      return 1000 + parseInt(match[1]);
    }

    const symptomMatch = questionId.match(/symptom-(\d+)/);
    if (symptomMatch) {
      return 10000 + parseInt(symptomMatch[1]);
    }

    // Other questions
    return 50000;
  }

  /**
   * Compare disease lists between c-diagnosis and askman
   */
  private compareDiseases(
    cDiagnosisDiseases: DiseaseResult[],
    askmanDiseases: DiseaseResult[]
  ): ComparisonResult['differences']['diseaseMismatch'] | undefined {
    const cIds = new Set(cDiagnosisDiseases.map(d => d.id));
    const aIds = new Set(askmanDiseases.map(d => d.id));

    // Find diseases only in c-diagnosis
    const cDiagnosisOnly = cDiagnosisDiseases.filter(d => !aIds.has(d.id));

    // Find diseases only in askman
    const askmanOnly = askmanDiseases.filter(d => !cIds.has(d.id));

    // Check for label differences (same disease, different label)
    const labelDifferences: Array<{ name: string; cLabel?: string; aLabel?: string }> = [];
    for (const cDisease of cDiagnosisDiseases) {
      const aDisease = askmanDiseases.find(d => d.id === cDisease.id);
      if (aDisease && cDisease.label !== aDisease.label) {
        labelDifferences.push({
          name: cDisease.name,
          cLabel: cDisease.label,
          aLabel: aDisease.label,
        });
      }
    }

    // Check order mismatch (if disease sets are the same)
    let orderMismatch = false;
    if (cDiagnosisOnly.length === 0 && askmanOnly.length === 0) {
      orderMismatch = !this.areDiseasesInSameOrder(cDiagnosisDiseases, askmanDiseases);
    }

    // If there are differences, return them
    if (cDiagnosisOnly.length > 0 || askmanOnly.length > 0 || orderMismatch || labelDifferences.length > 0) {
      return {
        cDiagnosisOnly,
        askmanOnly,
        orderMismatch: orderMismatch || undefined,
        labelDifferences: labelDifferences.length > 0 ? labelDifferences : undefined,
      } as any;
    }

    return undefined;
  }

  /**
   * Check if disease lists are in the same order
   */
  private areDiseasesInSameOrder(
    cDiagnosisDiseases: DiseaseResult[],
    askmanDiseases: DiseaseResult[]
  ): boolean {
    if (cDiagnosisDiseases.length !== askmanDiseases.length) {
      return false;
    }

    for (let i = 0; i < cDiagnosisDiseases.length; i++) {
      if (cDiagnosisDiseases[i].id !== askmanDiseases[i].id) {
        return false;
      }
    }

    return true;
  }

  /**
   * Format comparison result for console output
   */
  formatResult(result: ComparisonResult): string {
    const lines: string[] = [];

    if (result.passed) {
      lines.push('✅ PASSED - Results match');
    } else {
      lines.push('❌ FAILED - Results differ');
    }

    lines.push('');
    lines.push(`C-Diagnosis: ${result.cDiagnosisResult.diseases.length} diseases, ${result.cDiagnosisResult.questionCount} questions${result.cDiagnosisResult.error ? ' ⚠️ ERROR' : ''}`);
    lines.push(`Askman:      ${result.askmanResult.diseases.length} diseases, ${result.askmanResult.questionCount} questions${result.askmanResult.error ? ' ⚠️ ERROR' : ''}`);

    // Show disease lists grouped by section
    lines.push('');
    lines.push('Disease Results:');
    lines.push('  C-Diagnosis:');

    const cRelated = result.cDiagnosisResult.diseases.filter(d => d.section === 'related');
    const cMissed = result.cDiagnosisResult.diseases.filter(d => d.section === 'easily-missed');
    const cOther = result.cDiagnosisResult.diseases.filter(d => !d.section);

    if (cRelated.length > 0) {
      lines.push('    回答に関連する病気:');
      cRelated.forEach((d, i) => {
        const label = d.label ? `[${d.label}] ` : '';
        lines.push(`      ${i + 1}. ${label}${d.name}${d.probability ? ` - ${(d.probability * 100).toFixed(0)}%` : ''}`);
      });
    }
    if (cMissed.length > 0) {
      lines.push('    見逃されやすい病気:');
      cMissed.forEach((d, i) => {
        const label = d.label ? `[${d.label}] ` : '';
        lines.push(`      ${i + 1}. ${label}${d.name}${d.probability ? ` - ${(d.probability * 100).toFixed(0)}%` : ''}`);
      });
    }
    if (cOther.length > 0) {
      lines.push('    その他:');
      cOther.forEach((d, i) => {
        const label = d.label ? `[${d.label}] ` : '';
        lines.push(`      ${i + 1}. ${label}${d.name}${d.probability ? ` - ${(d.probability * 100).toFixed(0)}%` : ''}`);
      });
    }

    lines.push('  Askman:');

    const aRelated = result.askmanResult.diseases.filter(d => d.section === 'related');
    const aMissed = result.askmanResult.diseases.filter(d => d.section === 'easily-missed');
    const aOther = result.askmanResult.diseases.filter(d => !d.section);

    if (aRelated.length > 0) {
      lines.push('    回答に関連する病気:');
      aRelated.forEach((d, i) => {
        const label = d.label ? `[${d.label}] ` : '';
        lines.push(`      ${i + 1}. ${label}${d.name}${d.probability ? ` - ${(d.probability * 100).toFixed(0)}%` : ''}`);
      });
    }
    if (aMissed.length > 0) {
      lines.push('    見逃されやすい病気:');
      aMissed.forEach((d, i) => {
        const label = d.label ? `[${d.label}] ` : '';
        lines.push(`      ${i + 1}. ${label}${d.name}${d.probability ? ` - ${(d.probability * 100).toFixed(0)}%` : ''}`);
      });
    }
    if (aOther.length > 0) {
      lines.push('    その他:');
      aOther.forEach((d, i) => {
        const label = d.label ? `[${d.label}] ` : '';
        lines.push(`      ${i + 1}. ${label}${d.name}${d.probability ? ` - ${(d.probability * 100).toFixed(0)}%` : ''}`);
      });
    }

    if (result.differences.diseaseMismatch) {
      lines.push('');
      lines.push('Disease Differences:');

      if (result.differences.diseaseMismatch.cDiagnosisOnly.length > 0) {
        lines.push(`  Only in c-diagnosis: ${result.differences.diseaseMismatch.cDiagnosisOnly.map(d => d.name).join(', ')}`);
      }

      if (result.differences.diseaseMismatch.askmanOnly.length > 0) {
        lines.push(`  Only in askman: ${result.differences.diseaseMismatch.askmanOnly.map(d => d.name).join(', ')}`);
      }

      if ((result.differences.diseaseMismatch as any).labelDifferences?.length > 0) {
        lines.push('');
        lines.push('  Label Differences (same disease, different labels):');
        (result.differences.diseaseMismatch as any).labelDifferences.forEach((diff: any) => {
          const cLabelText = diff.cLabel ? `[${diff.cLabel}]` : '(no label)';
          const aLabelText = diff.aLabel ? `[${diff.aLabel}]` : '(no label)';
          lines.push(`    - ${diff.name}: C-Diagnosis ${cLabelText}, Askman ${aLabelText}`);
        });
      }

      if (result.differences.diseaseMismatch.orderMismatch) {
        lines.push('  ⚠️  Order mismatch detected');
      }
    }

    if (result.differences.questionCountMismatch) {
      lines.push('');
      lines.push('Question Count Mismatch:');
      lines.push(`  C-Diagnosis: ${result.differences.questionCountMismatch.cDiagnosis}`);
      lines.push(`  Askman: ${result.differences.questionCountMismatch.askman}`);
    }

    // Show error details if present
    if (result.cDiagnosisResult.error || result.askmanResult.error) {
      lines.push('');
      lines.push('━'.repeat(60));
      lines.push('⚠️  Error Details');
      lines.push('━'.repeat(60));

      if (result.cDiagnosisResult.error) {
        lines.push('');
        lines.push('C-Diagnosis Error:');
        lines.push(`  ${result.cDiagnosisResult.error}`);
        lines.push(`  Stopped after ${result.cDiagnosisResult.questionCount} questions`);
        if (result.cDiagnosisResult.screenshotPath) {
          lines.push(`  📸 Screenshot: ${result.cDiagnosisResult.screenshotPath}`);
        }

        // Show steps taken before error occurred
        if (result.cDiagnosisResult.questionLogs && result.cDiagnosisResult.questionLogs.length > 0) {
          lines.push('');
          lines.push('  Steps before error:');
          result.cDiagnosisResult.questionLogs.forEach((log, i) => {
            lines.push(`    ${i + 1}. ${log.url.split('/').pop()}`);
            if (log.questionText) {
              lines.push(`       Q: ${log.questionText}`);
            }
            if (log.selectedOption) {
              lines.push(`       A: ${log.selectedOption}`);
            }
          });
        }
      }

      if (result.askmanResult.error) {
        lines.push('');
        lines.push('Askman Error:');
        lines.push(`  ${result.askmanResult.error}`);
        lines.push(`  Stopped after ${result.askmanResult.questionCount} questions`);
        if (result.askmanResult.screenshotPath) {
          lines.push(`  📸 Screenshot: ${result.askmanResult.screenshotPath}`);
        }

        // Show steps taken before error occurred
        if (result.askmanResult.questionLogs && result.askmanResult.questionLogs.length > 0) {
          lines.push('');
          lines.push('  Steps before error:');
          result.askmanResult.questionLogs.forEach((log, i) => {
            lines.push(`    ${i + 1}. ${log.url.split('/').pop()}`);
            if (log.questionText) {
              lines.push(`       Q: ${log.questionText}`);
            }
            if (log.selectedOption) {
              lines.push(`       A: ${log.selectedOption}`);
            }
          });
        }
      }
    }

    // Add detailed question log comparison
    if (result.cDiagnosisResult.questionLogs || result.askmanResult.questionLogs) {
      lines.push('');
      lines.push('━'.repeat(60));
      lines.push('📋 Detailed Question Log Comparison');
      lines.push('━'.repeat(60));
      lines.push('');

      const cLogs = result.cDiagnosisResult.questionLogs || [];
      const aLogs = result.askmanResult.questionLogs || [];

      // Match questions by ID
      const matches = this.matchQuestions(cLogs, aLogs);

      // Track question numbers for each engine
      let cQuestionNum = 0;
      let aQuestionNum = 0;

      for (let i = 0; i < matches.length; i++) {
        const { cLog, aLog } = matches[i];

        lines.push('─'.repeat(60));

        // C-Diagnosis
        if (cLog) {
          cQuestionNum++;
          lines.push(`  [C-Diagnosis Q${cQuestionNum}]`);
          lines.push(`    URL: ${cLog.url}`);
          if (cLog.questionText) {
            lines.push(`    Question: ${cLog.questionText}`);
          }
          lines.push(`    Options: ${cLog.availableOptions.join(', ')}`);
          lines.push(`    Selected: ${cLog.selectedOption || 'N/A'}`);
        } else {
          lines.push(`  [C-Diagnosis] - No question logged`);
        }

        lines.push('');

        // Askman
        if (aLog) {
          aQuestionNum++;
          lines.push(`  [Askman Q${aQuestionNum}]`);
          lines.push(`    URL: ${aLog.url}`);
          if (aLog.questionText) {
            lines.push(`    Question: ${aLog.questionText}`);
          }
          lines.push(`    Options: ${aLog.availableOptions.join(', ')}`);
          lines.push(`    Selected: ${aLog.selectedOption || 'N/A'}`);
        } else {
          lines.push(`  [Askman] - No question logged`);
        }

        // Highlight differences
        const differences: string[] = [];

        if (!cLog || !aLog) {
          // One side is missing - this is a difference
          differences.push(!cLog ? 'Question only in Askman' : 'Question only in C-Diagnosis');
        } else {
          // Both exist - check for differences
          if (cLog.url !== aLog.url) {
            differences.push(`URL differs`);
          }
          if (cLog.questionText && aLog.questionText && cLog.questionText !== aLog.questionText) {
            differences.push(`Question text differs`);
          }
          if (cLog.selectedOption !== aLog.selectedOption) {
            differences.push(`Selected option differs`);
          }

          // Check option differences
          const cOptions = new Set(cLog.availableOptions);
          const aOptions = new Set(aLog.availableOptions);
          const cOnly = cLog.availableOptions.filter((o: string) => !aOptions.has(o));
          const aOnly = aLog.availableOptions.filter((o: string) => !cOptions.has(o));

          if (cOnly.length > 0 || aOnly.length > 0) {
            differences.push(`Available options differ`);
          }

          if (differences.length > 0) {
            lines.push('');
            // URL differsのみの場合は⚡️、それ以外は⚠️
            const icon = differences.length === 1 && differences[0] === 'URL differs' ? '⚡️' : '⚠️';
            lines.push(`  ${icon}  DIFFERENCES: ${differences.join(', ')}`);
            if (cOnly.length > 0) {
              lines.push(`      C-Diagnosis only: ${cOnly.slice(0, 3).join(', ')}`);
            }
            if (aOnly.length > 0) {
              lines.push(`      Askman only: ${aOnly.slice(0, 3).join(', ')}`);
            }
          }
        }

        if (differences.length > 0 && (!cLog || !aLog)) {
          // For one-sided questions, just show the difference marker
          lines.push('');
          lines.push(`  ⚠️  DIFFERENCES: ${differences.join(', ')}`);
        }

        lines.push('');
      }
    }

    return lines.join('\n');
  }
}
