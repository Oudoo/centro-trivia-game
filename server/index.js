require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const gameData = require('./questions.json');

const app = express();
const server = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const PORT = process.env.PORT || 4000;
const HOST_PASSWORD = process.env.HOST_PASSWORD || 'centro2026';

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL.split(',').map(u => u.trim()),
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(cors());
app.get('/', (req, res) => {
  res.json({ status: 'Centro Trivia Server running', players: Object.keys(players).length });
});

// ─── Game State ──────────────────────────────────────────────────────
// States: lobby | question | results | leaderboard | ended
let gameState = 'lobby';
let currentQuestionIndex = -1;
let questionStartTime = null;
let questionTimer = null;
const players = {};         // sessionId → { name, socketId, score, currentAnswer, answers[] }
const socketToSession = {}; // socketId → sessionId

const { timeLimitSeconds, maxPointsPerQuestion } = gameData.globalSettings;

// ─── Helpers ─────────────────────────────────────────────────────────
function getPlayerCount() {
  return Object.values(players).filter(p => p.socketId !== null).length;
}

function getAllPlayerCount() {
  return Object.keys(players).length;
}

function getAnsweredCount() {
  if (currentQuestionIndex < 0) return 0;
  return Object.values(players).filter(p => p.currentAnswer !== null).length;
}

function calculateScore(elapsedMs) {
  const elapsedSec = elapsedMs / 1000;
  const ratio = Math.min(elapsedSec / timeLimitSeconds, 1);
  return Math.round(maxPointsPerQuestion * (1 - ratio * 0.9));
}

function getLeaderboard(count = 10) {
  return Object.values(players)
    .map(p => ({ name: p.name, score: p.score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}

function getCurrentQuestion() {
  if (currentQuestionIndex < 0 || currentQuestionIndex >= gameData.questions.length) return null;
  const q = gameData.questions[currentQuestionIndex];
  return {
    id: q.id,
    question: q.question,
    options: q.options,
    questionNumber: currentQuestionIndex + 1,
    totalQuestions: gameData.questions.length,
  };
}

function broadcastPlayerCount() {
  io.emit('player:count', { count: getPlayerCount(), total: getAllPlayerCount() });
}

function broadcastGameState() {
  io.emit('game:state', { state: gameState });
}

function broadcastAnswerProgress() {
  io.emit('game:answerProgress', {
    answered: getAnsweredCount(),
    total: getAllPlayerCount(),
  });
}

function endQuestion() {
  if (questionTimer) {
    clearInterval(questionTimer);
    questionTimer = null;
  }

  const q = gameData.questions[currentQuestionIndex];
  const correctIndex = q.correctAnswerIndex;

  // Find the fastest correct answer
  let fastestPlayer = null;
  let fastestTime = Infinity;

  Object.values(players).forEach(p => {
    if (p.currentAnswer !== null && p.currentAnswer.optionIndex === correctIndex) {
      if (p.currentAnswer.elapsed < fastestTime) {
        fastestTime = p.currentAnswer.elapsed;
        fastestPlayer = p.name;
      }
    }
  });

  const results = {
    correctAnswerIndex: correctIndex,
    fastestPlayer: fastestPlayer,
    fastestTime: fastestTime === Infinity ? null : fastestTime,
    questionNumber: currentQuestionIndex + 1,
    totalQuestions: gameData.questions.length,
  };

  gameState = 'results';
  broadcastGameState();
  io.emit('game:results', results);

  const currentLeaderboard = getLeaderboard();

  // Send individual results to each player
  Object.values(players).forEach(p => {
    if (p.socketId) {
      const wasCorrect = p.currentAnswer !== null && p.currentAnswer.optionIndex === correctIndex;
      const pointsEarned = p.currentAnswer ? p.currentAnswer.points : 0;
      io.to(p.socketId).emit('player:result', {
        correct: wasCorrect,
        pointsEarned,
        totalScore: p.score,
        correctAnswerIndex: correctIndex,
        leaderboard: currentLeaderboard,
      });
    }
  });
}

// ─── Socket Handlers ─────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[Connect] ${socket.id}`);

  // Send current game state on connect
  socket.emit('game:state', { state: gameState });
  socket.emit('game:title', { title: gameData.gameTitle });
  broadcastPlayerCount();

  if (gameState === 'question' && questionStartTime) {
    const q = getCurrentQuestion();
    if (q) socket.emit('game:question', q);
  }

  // ─── Player Events ──────────────────────────────────────────────
  socket.on('player:join', ({ name, sessionId }) => {
    if (!name || !sessionId) return;

    // Check if this sessionId already exists (reconnect scenario)
    if (players[sessionId]) {
      const existing = players[sessionId];
      // Remove old socket mapping
      if (existing.socketId && socketToSession[existing.socketId]) {
        delete socketToSession[existing.socketId];
      }
      existing.socketId = socket.id;
      existing.name = name;
      socketToSession[socket.id] = sessionId;
      console.log(`[Reconnect] ${name} (${sessionId})`);

      socket.emit('player:joined', {
        name: existing.name,
        score: existing.score,
        sessionId,
        reconnected: true,
      });
    } else {
      players[sessionId] = {
        name,
        socketId: socket.id,
        score: 0,
        currentAnswer: null,
        answers: [],
      };
      socketToSession[socket.id] = sessionId;
      console.log(`[Join] ${name} (${sessionId})`);

      socket.emit('player:joined', {
        name,
        score: 0,
        sessionId,
        reconnected: false,
      });
    }

    broadcastPlayerCount();
  });

  socket.on('player:reconnect', ({ sessionId }) => {
    if (!sessionId || !players[sessionId]) {
      socket.emit('player:reconnectFailed');
      return;
    }

    const existing = players[sessionId];
    if (existing.socketId && socketToSession[existing.socketId]) {
      delete socketToSession[existing.socketId];
    }
    existing.socketId = socket.id;
    socketToSession[socket.id] = sessionId;

    console.log(`[Reconnect] ${existing.name} (${sessionId})`);

    socket.emit('player:joined', {
      name: existing.name,
      score: existing.score,
      sessionId,
      reconnected: true,
    });

    socket.emit('game:state', { state: gameState });
    broadcastPlayerCount();

    // If a question is active, re-send it
    if (gameState === 'question') {
      const q = getCurrentQuestion();
      if (q) socket.emit('game:question', q);
      // If they already answered, let them know
      if (existing.currentAnswer !== null) {
        socket.emit('player:answerAcked');
      }
    }
  });

  socket.on('player:answer', ({ optionIndex, timestamp }) => {
    const sessionId = socketToSession[socket.id];
    if (!sessionId || !players[sessionId]) return;
    if (gameState !== 'question' || !questionStartTime) return;

    const player = players[sessionId];
    if (player.currentAnswer !== null) return; // Already answered

    const elapsed = timestamp - questionStartTime;
    const q = gameData.questions[currentQuestionIndex];
    const isCorrect = optionIndex === q.correctAnswerIndex;
    const points = isCorrect ? calculateScore(Math.max(0, elapsed)) : 0;

    player.currentAnswer = { optionIndex, elapsed, points };
    player.score += points;
    player.answers.push({
      questionId: q.id,
      optionIndex,
      elapsed,
      points,
      correct: isCorrect,
    });

    socket.emit('player:answerAcked');
    broadcastAnswerProgress();

    console.log(`[Answer] ${player.name}: option ${optionIndex} in ${elapsed}ms → ${points} pts`);

    // If everyone has answered, end immediately
    if (getAnsweredCount() >= getAllPlayerCount()) {
      endQuestion();
    }
  });

  // ─── Host Events ────────────────────────────────────────────────
  socket.on('host:authenticate', ({ password }, callback) => {
    const success = password === HOST_PASSWORD;
    if (success) {
      socket.join('hosts');
      console.log(`[Host] Authenticated: ${socket.id}`);
    }
    if (callback) callback({ success });
  });

  socket.on('host:startGame', () => {
    if (!socket.rooms.has('hosts')) return;
    if (gameState !== 'lobby') return;

    currentQuestionIndex = 0;
    sendQuestion();
  });

  socket.on('host:nextQuestion', () => {
    if (!socket.rooms.has('hosts')) return;
    if (gameState !== 'results' && gameState !== 'leaderboard') return;

    currentQuestionIndex++;
    if (currentQuestionIndex >= gameData.questions.length) {
      gameState = 'ended';
      broadcastGameState();
      io.emit('game:leaderboard', { leaderboard: getLeaderboard(), final: true });
      return;
    }
    sendQuestion();
  });

  socket.on('host:showLeaderboard', () => {
    if (!socket.rooms.has('hosts')) return;

    gameState = 'leaderboard';
    broadcastGameState();
    const isFinal = currentQuestionIndex >= gameData.questions.length - 1 && gameState !== 'question';
    io.emit('game:leaderboard', { leaderboard: getLeaderboard(), final: isFinal });
  });

  socket.on('host:endGame', () => {
    if (!socket.rooms.has('hosts')) return;

    if (questionTimer) {
      clearInterval(questionTimer);
      questionTimer = null;
    }
    gameState = 'ended';
    broadcastGameState();
    io.emit('game:leaderboard', { leaderboard: getLeaderboard(), final: true });
  });

  socket.on('host:resetGame', () => {
    if (!socket.rooms.has('hosts')) return;

    if (questionTimer) {
      clearInterval(questionTimer);
      questionTimer = null;
    }

    // Reset all state
    gameState = 'lobby';
    currentQuestionIndex = -1;
    questionStartTime = null;
    Object.values(players).forEach(p => {
      p.score = 0;
      p.currentAnswer = null;
      p.answers = [];
    });

    broadcastGameState();
    broadcastPlayerCount();
    console.log('[Host] Game reset');
  });

  // ─── Disconnect ─────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const sessionId = socketToSession[socket.id];
    if (sessionId && players[sessionId]) {
      players[sessionId].socketId = null;
      console.log(`[Disconnect] ${players[sessionId].name} (${sessionId}) — kept in state`);
    }
    delete socketToSession[socket.id];
    broadcastPlayerCount();
  });
});

// ─── Send Question ───────────────────────────────────────────────────
function sendQuestion() {
  // Reset all player answers for new question
  Object.values(players).forEach(p => {
    p.currentAnswer = null;
  });

  const q = getCurrentQuestion();
  if (!q) return;

  gameState = 'question';
  questionStartTime = Date.now();
  broadcastGameState();
  io.emit('game:question', q);
  broadcastAnswerProgress();

  // Start the countdown timer
  let timeLeft = timeLimitSeconds;
  io.emit('game:timer', { timeLeft });

  questionTimer = setInterval(() => {
    timeLeft--;
    io.emit('game:timer', { timeLeft });

    if (timeLeft <= 0) {
      endQuestion();
    }
  }, 1000);
}

// ─── Start Server ────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`🎮 Centro Trivia Server running on port ${PORT}`);
  console.log(`   Accepting connections from: ${FRONTEND_URL}`);
  console.log(`   Questions loaded: ${gameData.questions.length}`);
});
