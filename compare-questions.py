import json, sys, re

with open('reports/20251027_182628_20歳男性・頭痛がする.json') as f:
    data = json.load(f)

cLogs = data['questionLogs']['cDiagnosis']
aLogs = data['questionLogs']['askman']

print(f'\n🔍 20歳男性・頭痛がする - 質問フロー比較\n')
print(f'質問数: c-diagnosis={len(cLogs)}問, askman={len(aLogs)}問\n')
print('=' * 80 + '\n')

def extract_qid(url):
    # question-16123 や question/person などを抽出
    m = re.search(r'/(?:qa/)?(?:question/)?([a-z0-9-_]+)(?:\?|$)', url)
    return m.group(1) if m else 'unknown'

# URLの違いだけで質問内容が同じものはスキップ
found_diff = False
for i in range(min(len(cLogs), len(aLogs))):
    c = cLogs[i]
    a = aLogs[i]
    
    cText = c.get('questionText', '')
    aText = a.get('questionText', '')
    cAns = c.get('selectedOption', '')
    aAns = a.get('selectedOption', '')
    
    # 質問文または回答が異なる場合のみ違いとみなす
    if cText != aText or cAns != aAns:
        cQid = extract_qid(c['url'])
        aQid = extract_qid(a['url'])
        
        print(f'❗️ Q{i+1} - 最初の違いを発見!\n')
        print(f'[c-diagnosis]')
        print(f'  質問ID: {cQid}')
        print(f'  質問文: {cText}')
        print(f'  回答: {cAns}\n')
        print(f'[askman]')
        print(f'  質問ID: {aQid}')
        print(f'  質問文: {aText}')
        print(f'  回答: {aAns}\n')
        
        if cText == aText:
            print('→ 同じ質問だが回答が異なる (ランダム選択が異なった)\n')
        else:
            print('→ 異なる質問が出ている (エンジンの違い)\n')
        found_diff = True
        break

if not found_diff:
    print(f'✅ 全{len(cLogs)}問の質問文と回答が完全一致\n')
    print('しかし疾患結果が異なる場合、以下の可能性があります:')
    print('  1. 結果計算ロジックの違い')
    print('  2. 同じ質問・回答でも内部的な処理が異なる\n')
