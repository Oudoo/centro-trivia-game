'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket } from '@/lib/socket';

export default function HostPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [gameState, setGameState] = useState('lobby');
    const [playerCount, setPlayerCount] = useState({ count: 0, total: 0 });
    const [answerProgress, setAnswerProgress] = useState({ answered: 0, total: 0 });
    const [question, setQuestion] = useState(null);
    const [timeLeft, setTimeLeft] = useState(10);
    const [results, setResults] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const socketRef = useRef(null);

    useEffect(() => {
        const socket = getSocket();
        socketRef.current = socket;

        socket.on('game:state', ({ state }) => setGameState(state));
        socket.on('player:count', (data) => setPlayerCount(data));
        socket.on('game:answerProgress', (data) => setAnswerProgress(data));
        socket.on('game:question', (q) => setQuestion(q));
        socket.on('game:timer', ({ timeLeft: tl }) => setTimeLeft(tl));
        socket.on('game:results', (res) => setResults(res));
        socket.on('game:leaderboard', ({ leaderboard: lb }) => setLeaderboard(lb));

        return () => {
            socket.off('game:state');
            socket.off('player:count');
            socket.off('game:answerProgress');
            socket.off('game:question');
            socket.off('game:timer');
            socket.off('game:results');
            socket.off('game:leaderboard');
        };
    }, []);

    const handleAuth = useCallback((e) => {
        e.preventDefault();
        const socket = socketRef.current;
        socket.emit('host:authenticate', { password }, ({ success }) => {
            if (success) {
                setIsAuthenticated(true);
                setAuthError('');
            } else {
                setAuthError('Invalid password');
            }
        });
    }, [password]);

    const emit = useCallback((event) => {
        socketRef.current?.emit(event);
    }, []);

    // ─── AUTH SCREEN ──────────────────────────────────────────────────
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-centro-gray">
                <div className="animate-fadeIn w-full max-w-sm">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-black">🎮 Host Dashboard</h1>
                        <p className="text-centro-white/50 mt-2">Enter the host password to continue</p>
                    </div>
                    <form onSubmit={handleAuth} className="space-y-4">
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password..."
                            autoFocus
                            className="w-full px-5 py-4 rounded-xl text-lg font-bold text-centro-dark bg-centro-white placeholder-centro-gray/50 outline-none focus:ring-4 focus:ring-centro-white/30 transition-all"
                        />
                        {authError && (
                            <p className="text-red-400 text-sm text-center">{authError}</p>
                        )}
                        <button
                            type="submit"
                            className="w-full py-4 rounded-xl text-lg font-black bg-centro-dark text-centro-white hover:bg-centro-dark/80 transition-all active:scale-95"
                        >
                            AUTHENTICATE
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // ─── HOST DASHBOARD ───────────────────────────────────────────────
    const stateLabels = {
        lobby: '🟢 Lobby',
        question: '🔴 Live Question',
        results: '📊 Showing Results',
        leaderboard: '🏆 Leaderboard',
        ended: '🏁 Game Ended',
    };

    return (
        <div className="min-h-screen p-6 bg-centro-gray">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black">🎮 Host Dashboard</h1>
                    <div className="mt-3 inline-block px-4 py-2 rounded-full bg-white/10 text-lg font-bold">
                        {stateLabels[gameState] || gameState}
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-3 mb-8">
                    <div className="bg-white/5 rounded-2xl p-5 text-center">
                        <p className="text-centro-white/50 text-sm font-bold uppercase">Connected</p>
                        <p className="text-4xl font-black mt-1">{playerCount.count}</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-5 text-center">
                        <p className="text-centro-white/50 text-sm font-bold uppercase">Total</p>
                        <p className="text-4xl font-black mt-1">{playerCount.total}</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-5 text-center">
                        <p className="text-centro-white/50 text-sm font-bold uppercase">Answered</p>
                        <p className="text-4xl font-black mt-1">
                            {answerProgress.answered}/{answerProgress.total}
                        </p>
                    </div>
                </div>

                {/* Current Question Info */}
                {question && gameState === 'question' && (
                    <div className="bg-white/5 rounded-2xl p-5 mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-centro-white/50 font-bold text-sm uppercase">
                                Q{question.questionNumber} / {question.totalQuestions}
                            </span>
                            <span className="text-2xl font-black" style={{
                                color: timeLeft <= 3 ? '#e21b3c' : timeLeft <= 6 ? '#d89e00' : '#26890c'
                            }}>
                                {timeLeft}s
                            </span>
                        </div>
                        <p className="text-lg font-bold">{question.question}</p>
                    </div>
                )}

                {/* Results Info */}
                {results && gameState === 'results' && (
                    <div className="bg-white/5 rounded-2xl p-5 mb-6">
                        <p className="text-centro-white/50 text-sm font-bold uppercase mb-2">Results</p>
                        {results.fastestPlayer ? (
                            <>
                                <p className="text-lg">⚡ Fastest: <span className="font-black">{results.fastestPlayer}</span></p>
                                <p className="text-centro-white/50">{(results.fastestTime / 1000).toFixed(2)}s</p>
                            </>
                        ) : (
                            <p className="text-lg text-centro-white/60">No correct answers</p>
                        )}
                    </div>
                )}

                {/* Leaderboard Preview */}
                {leaderboard.length > 0 && (
                    <div className="bg-white/5 rounded-2xl p-5 mb-6">
                        <p className="text-centro-white/50 text-sm font-bold uppercase mb-3">Top Players</p>
                        {leaderboard.slice(0, 5).map((p, i) => (
                            <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                                <span className="font-bold">{i + 1}. {p.name}</span>
                                <span className="font-black text-centro-white/80">{p.score}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Control Buttons */}
                <div className="grid grid-cols-2 gap-3">
                    {gameState === 'lobby' && (
                        <button
                            onClick={() => emit('host:startGame')}
                            className="col-span-2 py-5 rounded-2xl text-xl font-black bg-green-600 hover:bg-green-700 transition-all active:scale-95"
                        >
                            🚀 START GAME
                        </button>
                    )}

                    {(gameState === 'results' || gameState === 'leaderboard') && (
                        <>
                            <button
                                onClick={() => emit('host:nextQuestion')}
                                className="py-5 rounded-2xl text-lg font-black bg-blue-600 hover:bg-blue-700 transition-all active:scale-95"
                            >
                                ➡️ Next Question
                            </button>
                            <button
                                onClick={() => emit('host:showLeaderboard')}
                                className="py-5 rounded-2xl text-lg font-black bg-yellow-600 hover:bg-yellow-700 transition-all active:scale-95"
                            >
                                🏆 Leaderboard
                            </button>
                        </>
                    )}

                    {gameState !== 'lobby' && gameState !== 'ended' && (
                        <button
                            onClick={() => emit('host:endGame')}
                            className="col-span-2 py-4 rounded-2xl text-lg font-black bg-red-600 hover:bg-red-700 transition-all active:scale-95"
                        >
                            🛑 END GAME
                        </button>
                    )}

                    {gameState === 'ended' && (
                        <button
                            onClick={() => emit('host:resetGame')}
                            className="col-span-2 py-5 rounded-2xl text-xl font-black bg-centro-dark hover:bg-centro-dark/80 transition-all active:scale-95"
                        >
                            🔄 RESET GAME
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
