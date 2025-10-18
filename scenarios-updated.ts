import { TestScenario } from './src/types';

export const scenarios: TestScenario[] = [
  // 全身症状
  { name: '35歳男性・熱がある', user: { age: 35, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'fever', text: '熱がある' }], answers: [] },
  { name: '28歳女性・体がだるい', user: { age: 28, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'fatigue', text: '体がだるい' }], answers: [] },
  { name: '45歳男性・肥満', user: { age: 45, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'obesity', text: '肥満' }], answers: [] },
  { name: '32歳女性・急激にやせた', user: { age: 32, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'weight-loss', text: '急激にやせた・体重が落ちた' }], answers: [] },
  { name: '50歳男性・意識を一時失った', user: { age: 50, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'syncope', text: '意識を一時失った後、戻っている' }], answers: [] },
  { name: '38歳女性・手足・顔のむくみ', user: { age: 38, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'edema', text: '手足・顔のむくみ' }], answers: [] },

  // 神経系
  { name: '42歳女性・頭痛', user: { age: 42, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'headache', text: '頭痛・頭が重い' }], answers: [] },
  { name: '55歳男性・めまい', user: { age: 55, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'dizziness', text: 'めまい・ふらつき・頭がふわふわする' }], answers: [] },
  { name: '48歳女性・しびれ', user: { age: 48, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'numbness', text: 'しびれ・感覚障害' }], answers: [] },
  { name: '52歳男性・手足に力が入らない', user: { age: 52, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'weakness', text: '手足に力が入らない' }], answers: [] },
  { name: '60歳女性・言葉がわからない', user: { age: 60, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'aphasia', text: '言葉がわからない、行動・認識がおかしい' }], answers: [] },
  { name: '38歳男性・けいれん', user: { age: 38, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'seizure', text: 'けいれん' }], answers: [] },
  { name: '45歳女性・ろれつが回らない', user: { age: 45, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'dysarthria', text: 'ろれつが回らない' }], answers: [] },

  // 消化器系
  { name: '35歳男性・腹痛', user: { age: 35, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'abdominal-pain', text: '腹痛・腹部不快感' }], answers: [] },
  { name: '30歳女性・吐き気がある', user: { age: 30, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'nausea', text: '吐き気がある・吐いている' }], answers: [] },
  { name: '40歳男性・下痢', user: { age: 40, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'diarrhea', text: '下痢' }], answers: [] },
  { name: '50歳女性・便秘', user: { age: 50, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'constipation', text: '便秘・放屁の増加' }], answers: [] },
  { name: '55歳男性・血便', user: { age: 55, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'bloody-stool', text: '便に血が混ざる・便が黒い' }], answers: [] },
  { name: '42歳女性・食欲がない', user: { age: 42, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'anorexia', text: '食欲がない' }], answers: [] },
  { name: '48歳男性・胸やけ', user: { age: 48, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'heartburn', text: '胸やけ・げっぷ・早期満腹感' }], answers: [] },
  { name: '62歳女性・食べ物を飲み込みにくい', user: { age: 62, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'dysphagia', text: '食べ物を飲み込みにくい' }], answers: [] },
  { name: '58歳男性・血を吐いた', user: { age: 58, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'hematemesis', text: '血を吐いた' }], answers: [] },

  // 循環器系
  { name: '52歳男性・胸痛', user: { age: 52, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'chest-pain', text: '胸が痛い・不快感や違和感がある' }], answers: [] },
  { name: '45歳女性・ドキドキする', user: { age: 45, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'palpitations', text: 'ドキドキする、脈が飛ぶ' }], answers: [] },
  { name: '65歳男性・脈が遅い', user: { age: 65, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'bradycardia', text: '脈が遅い' }], answers: [] },
  { name: '58歳女性・血圧が高い', user: { age: 58, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'hypertension', text: '血圧が高い、血圧が気になる' }], answers: [] },

  // 呼吸器系
  { name: '48歳男性・せき・たん', user: { age: 48, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'cough', text: 'せき・たんが出る、たんに血や泡が混ざる' }], answers: [] },
  { name: '55歳女性・息切れする', user: { age: 55, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'dyspnea', text: '息切れする、息が苦しい' }], answers: [] },
  { name: '42歳男性・ゼーゼー・ヒューヒュー', user: { age: 42, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'wheezing', text: 'ゼーゼー・ヒューヒューする' }], answers: [] },
  { name: '38歳女性・声がかすれる', user: { age: 38, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'hoarseness', text: '声がかすれる・出にくい' }], answers: [] },
  { name: '50歳男性・いびき', user: { age: 50, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'snoring', text: 'いびき' }], answers: [] },
  { name: '45歳女性・咽頭痛', user: { age: 45, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'sore-throat', text: '咽頭痛・発赤・腫脹' }], answers: [] },

  // 筋骨格系
  { name: '50歳男性・腰痛', user: { age: 50, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'back-pain', text: '腰が痛い' }], answers: [] },
  { name: '55歳女性・背中が痛い', user: { age: 55, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'back-pain-upper', text: '背中が痛い' }], answers: [] },
  { name: '48歳男性・筋肉や骨が痛い', user: { age: 48, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'muscle-pain', text: '筋肉や骨が痛い' }], answers: [] },
  { name: '60歳女性・関節痛', user: { age: 60, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'joint-pain', text: '関節痛・発赤・腫脹・こわばり' }], answers: [] },

  // 泌尿器系
  { name: '52歳男性・おしっこの痛み', user: { age: 52, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'dysuria', text: 'おしっこをした時、痛みがある' }], answers: [] },
  { name: '45歳女性・おしっこの回数が多い', user: { age: 45, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'frequency', text: 'おしっこの回数が多い' }], answers: [] },
  { name: '68歳男性・おしっこが少ない', user: { age: 68, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'oliguria', text: 'おしっこが濃くて少ない・出ていない' }], answers: [] },

  // 皮膚
  { name: '32歳女性・皮膚の異常', user: { age: 32, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'skin-abnormal', text: '皮膚の異常・乾燥・患部腫脹' }], answers: [] },
  { name: '40歳男性・すぐ血が出る', user: { age: 40, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'bleeding', text: 'すぐ血が出る・血が止まりにくい' }], answers: [] },

  // 眼科・耳鼻咽喉科
  { name: '58歳女性・視野が狭くなる', user: { age: 58, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'visual-field', text: '視野の一部が欠ける・視野が狭くなる' }], answers: [] },
  { name: '52歳男性・難聴', user: { age: 52, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'hearing-loss', text: '難聴・耳閉感・耳鳴・耳漏' }], answers: [] },

  // 婦人科
  { name: '35歳女性・生理の周期がおかしい', user: { age: 35, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'menstrual-irregular', text: '生理の周期がおかしい' }], answers: [] },
  { name: '42歳女性・乳房痛・腫瘤', user: { age: 42, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'breast-pain', text: '乳房痛・腫瘤・乳頭異常' }], answers: [] },

  // その他
  { name: '45歳男性・首のしこり', user: { age: 45, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'lymph-node', text: '首・わきの下・足の付根などにしこりがある' }], answers: [] },
  { name: '50歳女性・のどが渇く', user: { age: 50, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'thirst', text: 'のどが渇く・目が乾く' }], answers: [] },
  { name: '38歳男性・気持ちの落ち込み', user: { age: 38, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'depression', text: '気持ちの落ち込み' }], answers: [] },

  // 小児
  { name: '8歳男児・頭をいたがる', user: { age: 8, sex: 'male', relationship: 'myself' }, complaints: [{ id: 'headache-child', text: '頭をいたがる' }], answers: [] },
  { name: '6歳女児・低身長', user: { age: 6, sex: 'female', relationship: 'myself' }, complaints: [{ id: 'short-stature', text: '低身長' }], answers: [] },
];
