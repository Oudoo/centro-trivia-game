'use client';

import { useEffect, useState, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';

export default function DisplayPage() {
    const [screen, setScreen] = useState('lobby'); // lobby | question | results | leaderboard | ended
    const [gameTitle, setGameTitle] = useState('How Well Do You Know Centro?');
    const [playerCount, setPlayerCount] = useState(0);
    const [question, setQuestion] = useState(null);
    const [timeLeft, setTimeLeft] = useState(10);
    const [results, setResults] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [isFinal, setIsFinal] = useState(false);
    const [answerProgress, setAnswerProgress] = useState({ answered: 0, total: 0 });
    const confettiFired = useRef(false);
    const [playerUrl, setPlayerUrl] = useState('');

    useEffect(() => {
        const url = process.env.NEXT_PUBLIC_PLAYER_URL || window.location.origin;
        setPlayerUrl(url);
    }, []);

    useEffect(() => {
        const socket = getSocket();

        socket.on('game:title', ({ title }) => setGameTitle(title));
        socket.on('player:count', ({ count }) => setPlayerCount(count));

        socket.on('game:state', ({ state }) => {
            if (state === 'lobby') setScreen('lobby');
            else if (state === 'question') setScreen('question');
            else if (state === 'results') setScreen('results');
            else if (state === 'leaderboard') setScreen('leaderboard');
            else if (state === 'ended') setScreen('ended');
        });

        socket.on('game:question', (q) => {
            setQuestion(q);
            setTimeLeft(10);
            setResults(null);
            setScreen('question');
            confettiFired.current = false;
        });

        socket.on('game:timer', ({ timeLeft: tl }) => {
            setTimeLeft(tl);
        });

        socket.on('game:results', (res) => {
            setResults(res);
            setScreen('results');
        });

        socket.on('game:leaderboard', ({ leaderboard: lb, final }) => {
            setLeaderboard(lb);
            setIsFinal(final);
            setScreen(final ? 'ended' : 'leaderboard');

            if (final && !confettiFired.current) {
                confettiFired.current = true;
                fireConfetti();
            }
        });

        socket.on('game:answerProgress', (progress) => {
            setAnswerProgress(progress);
        });

        return () => {
            socket.off('game:title');
            socket.off('player:count');
            socket.off('game:state');
            socket.off('game:question');
            socket.off('game:timer');
            socket.off('game:results');
            socket.off('game:leaderboard');
            socket.off('game:answerProgress');
        };
    }, []);

    function fireConfetti() {
        const duration = 4000;
        const end = Date.now() + duration;

        const frame = () => {
            confetti({
                particleCount: 4,
                angle: 60,
                spread: 55,
                origin: { x: 0, y: 0.7 },
                colors: ['#004a59', '#ffffff', '#32373c', '#e21b3c', '#1368ce', '#d89e00', '#26890c'],
            });
            confetti({
                particleCount: 4,
                angle: 120,
                spread: 55,
                origin: { x: 1, y: 0.7 },
                colors: ['#004a59', '#ffffff', '#32373c', '#e21b3c', '#1368ce', '#d89e00', '#26890c'],
            });
            if (Date.now() < end) requestAnimationFrame(frame);
        };
        frame();
    }

    const answerColors = ['bg-answer-a', 'bg-answer-b', 'bg-answer-c', 'bg-answer-d'];
    const answerLabels = ['A', 'B', 'C', 'D'];
    const answerShapes = ['▲', '◆', '●', '■'];

    // ─── LOBBY ────────────────────────────────────────────────────────
    if (screen === 'lobby') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-centro-dark">
                <div className="animate-fadeIn text-center max-w-3xl">
                    <img src="/centro-logo.png" alt="Centro" className="h-20 mx-auto mb-8" />
                    <h1 className="text-5xl font-black tracking-tight mb-4">
                        {gameTitle}
                    </h1>
                    <p className="text-centro-white/60 text-xl mb-10">Scan the QR code to join!</p>

                    <div className="bg-white p-6 rounded-3xl inline-block shadow-2xl mb-10">
                        {playerUrl ? (
                            <QRCodeSVG
                                value={playerUrl}
                                size={280}
                                level="H"
                                fgColor="#004a59"
                                bgColor="#ffffff"
                            />
                        ) : (
                            <div style={{ width: 280, height: 280 }} className="flex items-center justify-center text-centro-gray">Loading QR...</div>
                        )}
                    </div>

                    <div className="flex items-center justify-center gap-3">
                        <div className="w-4 h-4 bg-green-400 rounded-full animate-pulse"></div>
                        <p className="text-3xl font-bold">
                            <span className="text-5xl font-black">{playerCount}</span>{' '}
                            <span className="text-centro-white/60">
                                {playerCount === 1 ? 'player' : 'players'} connected
                            </span>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ─── QUESTION ─────────────────────────────────────────────────────
    if (screen === 'question') {
        const timerPercent = (timeLeft / 10) * 100;
        const timerColor = timeLeft <= 3 ? '#e21b3c' : timeLeft <= 6 ? '#d89e00' : '#26890c';

        return (
            <div className="min-h-screen flex flex-col p-8 bg-centro-dark">
                {/* Header with timer */}
                <div className="flex items-center justify-between mb-6">
                    <div className="text-centro-white/50 font-bold text-lg uppercase tracking-widest">
                        Question {question?.questionNumber} / {question?.totalQuestions}
                    </div>
                    <div className="relative flex items-center justify-center">
                        <svg width="100" height="100" viewBox="0 0 100 100" className="-rotate-90">
                            <circle cx="50" cy="50" r="45" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
                            <circle
                                cx="50" cy="50" r="45"
                                stroke={timerColor}
                                strokeWidth="8"
                                fill="none"
                                strokeLinecap="round"
                                strokeDasharray={283}
                                strokeDashoffset={283 - (timerPercent / 100) * 283}
                                className="timer-circle"
                            />
                        </svg>
                        <span className="absolute text-4xl font-black" style={{ color: timerColor }}>
                            {timeLeft}
                        </span>
                    </div>
                </div>

                {/* Question */}
                <div className="text-center mb-10 animate-fadeIn">
                    <h2 className="text-4xl lg:text-5xl font-black leading-tight">
                        {question?.question}
                    </h2>
                </div>

                {/* Answer grid */}
                <div className="grid grid-cols-2 gap-4 flex-1 content-center max-w-5xl mx-auto w-full">
                    {question?.options.map((option, i) => (
                        <div
                            key={i}
                            className={`${answerColors[i]} rounded-2xl p-8 flex items-center gap-4 animate-slideUp`}
                            style={{ animationDelay: `${i * 100}ms` }}
                        >
                            <span className="text-4xl opacity-50">{answerShapes[i]}</span>
                            <span className="text-2xl lg:text-3xl font-bold">{option}</span>
                        </div>
                    ))}
                </div>

                {/* Answer progress */}
                <div className="text-center mt-6">
                    <p className="text-centro-white/40 text-lg">
                        {answerProgress.answered} / {answerProgress.total} answered
                    </p>
                </div>
            </div>
        );
    }

    // ─── RESULTS ──────────────────────────────────────────────────────
    if (screen === 'results') {
        const correctIdx = results?.correctAnswerIndex;
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-centro-dark">
                <div className="animate-fadeIn text-center max-w-4xl w-full">
                    <img src="/centro-logo.png" alt="Centro" className="h-12 mx-auto mb-6" />
                    <h2 className="text-3xl font-bold text-centro-white/60 mb-6 uppercase tracking-widest">
                        Correct Answer
                    </h2>

                    {/* Show the correct answer highlighted */}
                    {question?.options && (
                        <div className="grid grid-cols-2 gap-4 mb-10 max-w-4xl mx-auto">
                            {question.options.map((option, i) => (
                                <div
                                    key={i}
                                    className={`rounded-2xl p-6 flex items-center gap-4 transition-all duration-500 ${i === correctIdx
                                        ? `${answerColors[i]} animate-correctFlash ring-4 ring-white scale-105`
                                        : 'bg-centro-gray/30 opacity-40'
                                        }`}
                                >
                                    <span className="text-3xl opacity-50">{answerShapes[i]}</span>
                                    <span className="text-xl lg:text-2xl font-bold">{option}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Fastest finger */}
                    {results?.fastestPlayer ? (
                        <div className="animate-slideUp">
                            <p className="text-centro-white/50 text-xl mb-2">⚡ Fastest Finger</p>
                            <p className="text-6xl font-black text-centro-white mb-2">
                                {results.fastestPlayer}
                            </p>
                            <p className="text-2xl text-centro-white/60">
                                {(results.fastestTime / 1000).toFixed(2)}s
                            </p>
                        </div>
                    ) : (
                        <div className="animate-slideUp">
                            <p className="text-3xl font-bold text-centro-white/60">
                                No one got it right! 😅
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ─── LEADERBOARD / ENDED ──────────────────────────────────────────
    if (screen === 'leaderboard' || screen === 'ended') {
        const maxScore = leaderboard.length > 0 ? leaderboard[0].score : 1;
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-centro-dark">
                <div className="animate-fadeIn text-center max-w-3xl w-full">
                    <img src="/centro-logo.png" alt="Centro" className="h-12 mx-auto mb-6" />
                    {isFinal && (
                        <div className="mb-4">
                            <span className="text-6xl">🏆</span>
                        </div>
                    )}
                    <h2 className="text-4xl font-black mb-10 uppercase tracking-wider">
                        {isFinal ? 'Final Leaderboard' : 'Leaderboard'}
                    </h2>

                    <div className="space-y-3 w-full">
                        {leaderboard.map((player, i) => (
                            <div
                                key={i}
                                className="leaderboard-entry flex items-center gap-4 bg-white/5 rounded-2xl p-4 hover:bg-white/10 transition-colors"
                                style={{ animationDelay: `${i * 120}ms` }}
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl ${i === 0 ? 'bg-yellow-400 text-centro-dark' :
                                    i === 1 ? 'bg-gray-300 text-centro-dark' :
                                        i === 2 ? 'bg-amber-600 text-white' :
                                            'bg-centro-gray/30 text-centro-white/60'
                                    }`}>
                                    {i + 1}
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="text-xl font-bold">{player.name}</p>
                                    <div className="mt-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-centro-white/60 rounded-full animate-barFill"
                                            style={{ '--bar-width': `${(player.score / maxScore) * 100}%`, animationDelay: `${i * 120 + 200}ms` }}
                                        ></div>
                                    </div>
                                </div>
                                <div className="text-2xl font-black text-centro-white/80">
                                    {player.score}
                                </div>
                            </div>
                        ))}
                    </div>

                    {leaderboard.length === 0 && (
                        <p className="text-centro-white/40 text-xl">No scores yet</p>
                    )}

                    {isFinal && (
                        <p className="text-centro-white/40 mt-10 text-lg">Thanks for playing!</p>
                    )}
                </div>
            </div>
        );
    }

    return null;
}
