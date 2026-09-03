import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Calculator } from 'lucide-react';

interface MathCaptchaProps {
  onVerified: (verified: boolean) => void;
}

type Operator = '+' | '-' | '×';

function generateQuestion(): { a: number; b: number; op: Operator; answer: number } {
  const ops: Operator[] = ['+', '-', '×'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a: number;
  let b: number;
  let answer: number;

  if (op === '+') {
    a = Math.floor(Math.random() * 20) + 1;
    b = Math.floor(Math.random() * 20) + 1;
    answer = a + b;
  } else if (op === '-') {
    a = Math.floor(Math.random() * 20) + 1;
    b = Math.floor(Math.random() * a) + 1;
    answer = a - b;
  } else {
    a = Math.floor(Math.random() * 12) + 1;
    b = Math.floor(Math.random() * 12) + 1;
    answer = a * b;
  }

  return { a, b, op, answer };
}

export const MathCaptcha: React.FC<MathCaptchaProps> = ({ onVerified }) => {
  const [question, setQuestion] = useState(() => generateQuestion());
  const [userAnswer, setUserAnswer] = useState('');
  const [isCorrect, setIsCorrect] = useState(false);

  const refresh = useCallback(() => {
    setQuestion(generateQuestion());
    setUserAnswer('');
    setIsCorrect(false);
    onVerified(false);
  }, [onVerified]);

  useEffect(() => {
    onVerified(false);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9-]/g, '');
    setUserAnswer(val);
    if (val === '') {
      setIsCorrect(false);
      onVerified(false);
      return;
    }
    const num = parseInt(val, 10);
    const correct = num === question.answer;
    setIsCorrect(correct);
    onVerified(correct);
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
        <Calculator className="w-3.5 h-3.5 text-emerald-600" />
        Verifikasi Keamanan
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-center">
          <span className="text-sm font-bold text-slate-800 font-mono">
            {question.a} {question.op} {question.b} = ?
          </span>
        </div>
        <input
          type="text"
          inputMode="numeric"
          placeholder="?"
          value={userAnswer}
          onChange={handleChange}
          className={`w-16 text-center border rounded-lg px-2 py-2 text-sm font-bold focus:outline-none focus:ring-2 ${
            userAnswer === ''
              ? 'border-slate-200 focus:ring-emerald-500'
              : isCorrect
                ? 'border-emerald-400 bg-emerald-50 text-emerald-700 focus:ring-emerald-500'
                : 'border-rose-400 bg-rose-50 text-rose-700 focus:ring-rose-500'
          }`}
        />
        <button
          type="button"
          onClick={refresh}
          title="Soal baru"
          className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      {userAnswer !== '' && !isCorrect && (
        <p className="text-[10px] text-rose-500">Jawaban salah, coba lagi.</p>
      )}
    </div>
  );
};
