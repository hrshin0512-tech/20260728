import express from 'express';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(express.json());

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) {
  console.warn('WARNING: OPENAI_API_KEY is not set. The /api/generate endpoint will return 500.');
}

function getZodiac(month, day) {
  const z = [
    { name: '염소자리', start: [12,22], end: [1,19] },
    { name: '물병자리', start: [1,20], end: [2,18] },
    { name: '물고기자리', start: [2,19], end: [3,20] },
    { name: '양자리', start: [3,21], end: [4,19] },
    { name: '황소자리', start: [4,20], end: [5,20] },
    { name: '쌍둥이자리', start: [5,21], end: [6,21] },
    { name: '게자리', start: [6,22], end: [7,22] },
    { name: '사자자리', start: [7,23], end: [8,22] },
    { name: '처녀자리', start: [8,23], end: [9,22] },
    { name: '천칭자리', start: [9,23], end: [10,23] },
    { name: '전갈자리', start: [10,24], end: [11,22] },
    { name: '사수자리', start: [11,23], end: [12,21] }
  ];
  for (const sign of z) {
    const [sM, sD] = sign.start;
    const [eM, eD] = sign.end;
    if (sM === eM) {
      if (month === sM && day >= sD && day <= eD) return sign.name;
    } else if (sM < eM) {
      if ((month === sM && day >= sD) || (month === eM && day <= eD) || (month > sM && month < eM)) return sign.name;
    } else {
      if ((month === sM && day >= sD) || (month === eM && day <= eD) || month > sM || month < eM) return sign.name;
    }
  }
  return '알 수 없음';
}

function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function sampleUniqueNumbersSeeded(count, max, seed) {
  const rnd = mulberry32(seed);
  const pool = Array.from({ length: max }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count).sort((a,b) => a-b);
}

app.post('/api/generate', async (req, res) => {
  try {
    const { dob } = req.body;
    if (!dob) return res.status(400).json({ error: 'dob required in yyyy-mm-dd' });
    const [y,m,d] = dob.split('-').map(Number);
    const zodiac = getZodiac(m, d);
    let seed = 0;
    const seedStr = `${dob}-${zodiac}`;
    for (let i = 0; i < seedStr.length; i++) seed = ((seed << 5) - seed) + seedStr.charCodeAt(i);
    seed = seed >>> 0;
    const numbers = sampleUniqueNumbersSeeded(6, 45, seed + 13);
    const availableForBonus = Array.from({ length: 45 }, (_, i) => i + 1).filter(n => !numbers.includes(n));
    const rnd = mulberry32(seed + 97);
    const bonus = availableForBonus[Math.floor(rnd() * availableForBonus.length)];

    // Build prompt for explanation
    const prompt = `사용자 생년월일: ${dob}\n별자리: ${zodiac}\n선택된 번호: ${numbers.join(', ')}\n보너스: ${bonus}\n\n위 정보를 바탕으로 한국어로 2-4문장 내외의 간결한 설명을 만들어주세요. 설명은 왜 이 번호들을 선택했는지(별자리 특성, 생년월일 숫자 연관성, 무작위성 등)를 포함해야 합니다.`;

    if (!OPENAI_KEY) {
      return res.json({ zodiac, numbers, bonus, explanation: `OpenAI API key가 설정되어 있지 않아 로컬 규칙으로 생성된 결과입니다.` });
    }

    const resp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({ model: 'gpt-5.4-mini', input: prompt, max_output_tokens: 300 })
    });

    const data = await resp.json();
    let explanation = '';
    try {
      if (data.output && data.output.length > 0) {
        // extract text content
        const parts = data.output[0].content || [];
        explanation = parts.map(p => p.text || '').join('').trim();
      } else if (data.output_text) {
        explanation = data.output_text;
      } else {
        explanation = JSON.stringify(data);
      }
    } catch (err) {
      explanation = '모델 응답을 해석하는데 실패했습니다.';
    }

    res.json({ zodiac, numbers, bonus, explanation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

const port = process.env.PORT || 5173;
app.listen(port, () => console.log(`API server running on http://localhost:${port}`));
