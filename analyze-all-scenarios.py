import json, os, re

reports_dir = 'reports'
json_files = [f for f in os.listdir(reports_dir) if f.endswith('.json')]

print('\n📊 50シナリオ - 質問フロー違い分析\n')
print('=' * 100)

patterns = {
    'same_all': [],  # 質問も回答も全て同じ
    'diff_answer': [],  # 同じ質問だが回答が異なる
    'diff_question': [],  # 異なる質問が出現
    'diff_count': [],  # 質問数が異なる
}

for idx, file in enumerate(sorted(json_files)[:10], 1):  # 最初の10件を分析
    with open(os.path.join(reports_dir, file)) as f:
        data = json.load(f)
    
    if not data.get('passed'):
        scenario_name = file.replace('.json', '').split('_', 1)[1]
        
        cLogs = data.get('questionLogs', {}).get('cDiagnosis', [])
        aLogs = data.get('questionLogs', {}).get('askman', [])
        
        if not cLogs or not aLogs:
            continue
        
        # 質問数チェック
        if len(cLogs) != len(aLogs):
            patterns['diff_count'].append({
                'name': scenario_name,
                'c_count': len(cLogs),
                'a_count': len(aLogs),
            })
            continue
        
        # 質問文と回答の比較
        found_diff = False
        for i in range(len(cLogs)):
            c = cLogs[i]
            a = aLogs[i]
            
            cText = c.get('questionText', '')
            aText = a.get('questionText', '')
            cAns = c.get('selectedOption', '')
            aAns = a.get('selectedOption', '')
            
            if cText != aText:
                patterns['diff_question'].append({
                    'name': scenario_name,
                    'q_num': i + 1,
                    'c_text': cText,
                    'a_text': aText,
                })
                found_diff = True
                break
            elif cAns != aAns:
                patterns['diff_answer'].append({
                    'name': scenario_name,
                    'q_num': i + 1,
                    'question': cText,
                    'c_ans': cAns,
                    'a_ans': aAns,
                })
                found_diff = True
                break
        
        if not found_diff:
            patterns['same_all'].append(scenario_name)

print(f'\n📋 分析結果 (最初の10シナリオ)\n')

print(f'\n1️⃣ 質問数が異なる: {len(patterns["diff_count"])}件')
for p in patterns['diff_count'][:3]:
    print(f'   - {p["name"]}: c-diagnosis={p["c_count"]}問, askman={p["a_count"]}問')

print(f'\n2️⃣ 同じ質問だが回答が異なる: {len(patterns["diff_answer"])}件')
for p in patterns['diff_answer'][:3]:
    print(f'   - {p["name"]}: Q{p["q_num"]}')
    print(f'     質問: {p["question"][:60]}...')
    print(f'     c-diagnosis→「{p["c_ans"]}」, askman→「{p["a_ans"]}」')

print(f'\n3️⃣ 異なる質問が出現: {len(patterns["diff_question"])}件')
for p in patterns['diff_question'][:3]:
    print(f'   - {p["name"]}: Q{p["q_num"]}')
    print(f'     c-diagnosis: {p["c_text"][:50]}...')
    print(f'     askman: {p["a_text"][:50]}...')

print(f'\n4️⃣ 全ての質問と回答が一致: {len(patterns["same_all"])}件')
for name in patterns['same_all'][:3]:
    print(f'   - {name}')

print('\n' + '=' * 100 + '\n')
