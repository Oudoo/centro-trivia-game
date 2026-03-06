'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket } from '@/lib/socket';

function generateSessionId() {
  return 'sess_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export default function PlayerPage() {
  const [screen, setScreen] = useState('join'); // join | waiting | question | answered | result | ended
  const [name, setName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [totalScore, setTotalScore] = useState(0);
  const [question, setQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [result, setResult] = useState(null);
  const [gameTitle, setGameTitle] = useState('');
  const [shaking, setShaking] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [isFinal, setIsFinal] = useState(false);
  const socketRef = useRef(null);
  const questionStartRef = useRef(null);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    // Try to reconnect from localStorage
    const savedSession = localStorage.getItem('centro_session');
    const savedName = localStorage.getItem('centro_name');
    if (savedSession) {
      socket.emit('player:reconnect', { sessionId: savedSession });
      if (savedName) setPlayerName(savedName);
    }

    socket.on('game:title', ({ title }) => setGameTitle(title));

    socket.on('game:state', ({ state }) => {
      if (state === 'lobby') {
        if (playerName || savedName) {
          setScreen('waiting');
        }
      } else if (state === 'ended') {
        setScreen('ended');
      }
    });

    socket.on('player:joined', ({ name: pName, score, sessionId, reconnected }) => {
      localStorage.setItem('centro_session', sessionId);
      localStorage.setItem('centro_name', pName);
      setPlayerName(pName);
      setTotalScore(score);
      setScreen('waiting');
    });

    socket.on('player:reconnectFailed', () => {
      localStorage.removeItem('centro_session');
      localStorage.removeItem('centro_name');
      setScreen('join');
    });

    socket.on('game:question', (q) => {
      setQuestion(q);
      setSelectedAnswer(null);
      setResult(null);
      questionStartRef.current = Date.now();
      setScreen('question');
    });

    socket.on('player:answerAcked', () => {
      setScreen('answered');
    });

    socket.on('player:result', (res) => {
      setResult(res);
      setTotalScore(res.totalScore);
      if (!res.correct) {
        setShaking(true);
        setTimeout(() => setShaking(false), 600);
      }
      setScreen('result');
    });

    socket.on('game:leaderboard', ({ leaderboard: lb, final }) => {
      setLeaderboard(lb);
      setIsFinal(final);
      if (final) setScreen('ended');
    });

    return () => {
      socket.off('game:title');
      socket.off('game:state');
      socket.off('player:joined');
      socket.off('player:reconnectFailed');
      socket.off('game:question');
      socket.off('player:answerAcked');
      socket.off('player:result');
      socket.off('game:leaderboard');
    };
  }, []);

  const handleJoin = useCallback((e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const socket = socketRef.current;
    let sessionId = localStorage.getItem('centro_session');
    if (!sessionId) {
      sessionId = generateSessionId();
    }
    socket.emit('player:join', { name: name.trim(), sessionId });
  }, [name]);

  const handleAnswer = useCallback((optionIndex) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(optionIndex);
    const socket = socketRef.current;
    socket.emit('player:answer', {
      optionIndex,
      timestamp: Date.now(),
    });
  }, [selectedAnswer]);

  const answerColors = [
    'bg-answer-a hover:bg-red-700',
    'bg-answer-b hover:bg-blue-700',
    'bg-answer-c hover:bg-yellow-600',
    'bg-answer-d hover:bg-green-700',
  ];

  const answerLabels = ['A', 'B', 'C', 'D'];
  const answerShapes = ['▲', '◆', '●', '■'];

  // ─── JOIN SCREEN ─────────────────────────────────────────────────
  if (screen === 'join') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-centro-dark">
        <div className="animate-fadeIn w-full max-w-sm">
          <div className="text-center mb-8">
            <img src="/centro-logo.png" alt="Centro" className="h-14 mx-auto mb-4" />
            <h1 className="text-2xl font-black tracking-tight">
              {gameTitle || 'Centro Trivia'}
            </h1>
            <p className="text-centro-white/60 mt-2 text-sm">Enter your name to join the game</p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your nickname..."
              maxLength={20}
              autoFocus
              className="w-full px-5 py-4 rounded-xl text-lg font-bold text-centro-dark bg-centro-white placeholder-centro-gray/50 outline-none focus:ring-4 focus:ring-centro-white/30 transition-all"
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="w-full py-4 rounded-xl text-lg font-black bg-centro-white text-centro-dark hover:bg-centro-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              JOIN GAME
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─── WAITING SCREEN ──────────────────────────────────────────────
  if (screen === 'waiting') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-centro-dark">
        <div className="animate-fadeIn text-center">
          <img src="/centro-logo.png" alt="Centro" className="h-12 mx-auto mb-6 animate-pulse-glow" />
          <h2 className="text-2xl font-black mb-2">You&apos;re in, {playerName}!</h2>
          <div className="flex items-center justify-center gap-2 mt-6">
            <div className="w-3 h-3 bg-centro-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-3 h-3 bg-centro-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-3 h-3 bg-centro-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <p className="text-centro-white/60 mt-4 text-lg">Waiting for host to start...</p>
          {totalScore > 0 && (
            <p className="text-centro-white/40 mt-2 text-sm">Your score: {totalScore}</p>
          )}
        </div>
      </div>
    );
  }

  // ─── QUESTION SCREEN ─────────────────────────────────────────────
  if (screen === 'question') {
    return (
      <div className="min-h-screen flex flex-col p-4 bg-centro-dark">
        <div className="text-center mb-4 animate-fadeIn">
          <img src="/centro-logo.png" alt="Centro" className="h-8 mx-auto mb-2" />
          <p className="text-centro-white/50 text-sm font-bold uppercase tracking-widest">
            Question {question?.questionNumber} of {question?.totalQuestions}
          </p>
        </div>

        <div className="flex-1 grid grid-cols-1 gap-3 content-center">
          {question?.options.map((option, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(i)}
              disabled={selectedAnswer !== null}
              className={`answer-btn ${answerColors[i]} ${selectedAnswer === i ? 'ring-4 ring-white scale-95' : ''
                }`}
              style={{
                animationDelay: `${i * 80}ms`,
              }}
            >
              <span className="mr-3 text-2xl opacity-70">{answerShapes[i]}</span>
              <span className="text-lg">{option}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── ANSWERED (WAITING) SCREEN ────────────────────────────────────
  if (screen === 'answered') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-centro-dark">
        <div className="animate-fadeIn text-center">
          <img src="/centro-logo.png" alt="Centro" className="h-8 mx-auto mb-6" />
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-centro-white/10 flex items-center justify-center">
            <svg className="w-10 h-10 text-centro-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-black">Answer Locked In!</h2>
          <p className="text-centro-white/50 mt-3">Waiting for everyone else...</p>
        </div>
      </div>
    );
  }

  // ─── RESULT SCREEN ────────────────────────────────────────────────
  if (screen === 'result') {
    const isCorrect = result?.correct;
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 bg-centro-dark ${shaking ? 'animate-shake' : ''}`}>
        <div className="animate-fadeIn text-center">
          <img src="/centro-logo.png" alt="Centro" className="h-8 mx-auto mb-6" />
          <div className="text-7xl mb-6">
            {isCorrect ? '🎉' : '😢'}
          </div>
          <h2 className="text-3xl font-black mb-2">
            {isCorrect ? 'Correct!' : 'Wrong!'}
          </h2>
          {isCorrect && (
            <p className="text-2xl font-bold text-green-300">
              +{result.pointsEarned} pts
            </p>
          )}
          <div className="mt-8 px-6 py-4 bg-white/10 rounded-2xl">
            <p className="text-centro-white/60 text-sm">Total Score</p>
            <p className="text-4xl font-black">{totalScore}</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── ENDED / FINAL SCREEN ────────────────────────────────────────
  if (screen === 'ended') {
    const rank = leaderboard.findIndex(p => p.name === playerName) + 1;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-centro-dark">
        <div className="animate-fadeIn text-center w-full max-w-sm">
          <img src="/centro-logo.png" alt="Centro" className="h-10 mx-auto mb-6" />
          <h2 className="text-3xl font-black mb-2">Game Over!</h2>
          <div className="mt-6 px-6 py-5 bg-white/10 rounded-2xl">
            <p className="text-centro-white/60 text-sm">Your Final Score</p>
            <p className="text-5xl font-black mt-1">{totalScore}</p>
            {rank > 0 && (
              <p className="text-centro-white/50 mt-2 text-lg">
                Rank: <span className="font-bold text-centro-white">#{rank}</span>
              </p>
            )}
          </div>
          <p className="text-centro-white/40 mt-8 text-sm">Thanks for playing, {playerName}!</p>
        </div>
      </div>
    );
  }

  return null;
}
