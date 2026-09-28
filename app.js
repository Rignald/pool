/**
 * Pool & Biljart Scoreboard - Progressive Web App
 * Features: Touch scoring, Timer, Fouls, Live Timeline, Audio Synthesizer,
 * Screen WakeLock, Tournament stats, LocalStorage persistence, Android PWA.
 */

(() => {
  'use strict';

  // Available Avatar Emojis
  const EMOJIS = ['🐸', '🐄', '🦁', '🐯', '🦊', '🐻', '🐘', '🦈', '🦅', '🦜', '👽', '🤖', '🎱', '🎯', '👑', '⚡', '🏆', '🔥'];

  // Color Gradients
  const COLOR_THEMES = {
    p1: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 50%, #2563eb 100%)',
    p2: 'linear-gradient(135deg, #991b1b 0%, #b91c1c 50%, #dc2626 100%)',
    green: 'linear-gradient(135deg, #065f46 0%, #047857 50%, #059669 100%)',
    orange: 'linear-gradient(135deg, #9a3412 0%, #c2410c 50%, #ea580c 100%)',
    purple: 'linear-gradient(135deg, #581c87 0%, #6b21a8 50%, #7e22ce 100%)',
    pink: 'linear-gradient(135deg, #831843 0%, #9d174d 50%, #be185d 100%)',
    teal: 'linear-gradient(135deg, #134e4a 0%, #0f766e 50%, #0d9488 100%)',
    dark: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%)'
  };

  // Ball Colors for Official Pool Numbers (1 to 15)
  const BALL_COLORS = {
    1: { bg: '#eab308', text: '#000' }, // Yellow
    2: { bg: '#2563eb', text: '#fff' }, // Blue
    3: { bg: '#dc2626', text: '#fff' }, // Red
    4: { bg: '#7c3aed', text: '#fff' }, // Purple
    5: { bg: '#ea580c', text: '#fff' }, // Orange
    6: { bg: '#16a34a', text: '#fff' }, // Green
    7: { bg: '#78350f', text: '#fff' }, // Maroon
    8: { bg: '#09090b', text: '#fff' }, // Black
    9: { bg: '#fde047', text: '#000' },
    10: { bg: '#60a5fa', text: '#fff' },
    11: { bg: '#f87171', text: '#fff' },
    12: { bg: '#a78bfa', text: '#fff' },
    13: { bg: '#fb923c', text: '#fff' },
    14: { bg: '#4ade80', text: '#000' },
    15: { bg: '#a16207', text: '#fff' }
  };

  // Main Application State
  const state = {
    players: [
      { name: 'Rignald', emoji: '🐸', color: 'p1', score: 0, wins: 0, fouls: { eightball: 0, whiteball: 0 } },
      { name: 'Shuhung', emoji: '🐄', color: 'p2', score: 0, wins: 0, fouls: { eightball: 0, whiteball: 0 } }
    ],
    roundNumber: 1,
    targetWins: 5,
    gameMode: 'pool-8ball',
    eightballPenalty: 1,
    timer: {
      totalMs: 7200000, // 2 hours
      remainingMs: 7200000,
      isRunning: false,
      intervalId: null,
      autoReset: true,
      lastTickTs: null
    },
    liveTimeline: [],
    gameHistory: [],
    settings: {
      soundMaster: true,
      soundVolume: 80,
      voiceAnnounce: false,
      hapticEnabled: true,
      wakeLockEnabled: true
    },
    editingPlayerIdx: null,
    debounceClick: false,
    wakeLockSentinel: null,
    deferredInstallPrompt: null
  };

  // Storage Keys
  const STORAGE_KEY = 'pool_biljart_scoreboard_state_v3';

  // Audio Context (Synthesized effects)
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Sound Synthesizer: Pool Ball Collision
  function playBallClackSound() {
    if (!state.settings.soundMaster) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const vol = (state.settings.soundVolume / 100) * 0.4;
      const now = ctx.currentTime;

      // Noise burst for sharp click
      const bufferSize = ctx.sampleRate * 0.04;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.Q.setValueAtTime(3, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);

      // Resonant body ping of solid pool ball
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(820, now);
      osc.frequency.exponentialRampToValueAtTime(500, now + 0.05);

      oscGain.gain.setValueAtTime(vol * 0.6, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {}
  }

  // Sound Synthesizer: Foul Sound
  function playFoulSound() {
    if (!state.settings.soundMaster) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const vol = (state.settings.soundVolume / 100) * 0.35;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.linearRampToValueAtTime(160, now + 0.25);

      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.26);
    } catch (e) {}
  }

  // Sound Synthesizer: Undo Chalk Sound
  function playChalkUndoSound() {
    if (!state.settings.soundMaster) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const vol = (state.settings.soundVolume / 100) * 0.25;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.linearRampToValueAtTime(400, now + 0.15);

      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } catch (e) {}
  }

  // Sound Synthesizer: Time Up Bell
  function playTimeUpChimes() {
    if (!state.settings.soundMaster) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const vol = (state.settings.soundVolume / 100) * 0.4;
      const freqs = [880, 1100, 1320];

      freqs.forEach((freq, idx) => {
        const now = ctx.currentTime + (idx * 0.18);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.36);
      });
    } catch (e) {}
  }

  // Sound Synthesizer: Fanfare on Match End
  function playVictoryFanfare() {
    if (!state.settings.soundMaster) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const vol = (state.settings.soundVolume / 100) * 0.35;
      const melody = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

      melody.forEach((freq, idx) => {
        const now = ctx.currentTime + (idx * 0.14);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (idx === 3 ? 0.6 : 0.25));

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.7);
      });
    } catch (e) {}
  }

  // Haptic feedback
  function triggerHaptic(duration = 20) {
    if (state.settings.hapticEnabled && navigator.vibrate) {
      try {
        navigator.vibrate(duration);
      } catch (e) {}
    }
  }

  // Dutch Voice Score Announcer
  function announceScore() {
    if (!state.settings.voiceAnnounce || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const p1 = state.players[0];
      const p2 = state.players[1];
      const text = `${p1.name} ${p1.score}, ${p2.name} ${p2.score}`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'nl-NL';
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    } catch (e) {}
  }

  // Toast Notification
  function showToast(text, icon = '🎱') {
    const el = document.getElementById('toastMsg');
    const txt = document.getElementById('toastText');
    const ico = document.getElementById('toastIcon');
    if (!el || !txt) return;

    txt.textContent = text;
    if (ico) ico.textContent = icon;
    el.classList.add('show');
    clearTimeout(el.dataset.timeoutId);
    el.dataset.timeoutId = setTimeout(() => {
      el.classList.remove('show');
    }, 2200);
  }

  // Screen Wake Lock API (keeps mobile display awake)
  async function toggleWakeLock(enable) {
    if (!('wakeLock' in navigator)) {
      updateWakeLockUI(false, false);
      return;
    }
    try {
      if (enable) {
        if (!state.wakeLockSentinel) {
          state.wakeLockSentinel = await navigator.wakeLock.request('screen');
          state.wakeLockSentinel.addEventListener('release', () => {
            state.wakeLockSentinel = null;
            updateWakeLockUI(false, true);
          });
          updateWakeLockUI(true, true);
        }
      } else {
        if (state.wakeLockSentinel) {
          await state.wakeLockSentinel.release();
          state.wakeLockSentinel = null;
          updateWakeLockUI(false, true);
        }
      }
    } catch (err) {
      updateWakeLockUI(false, true);
    }
  }

  function updateWakeLockUI(isActive, isSupported) {
    const btn = document.getElementById('wakeLockBtn');
    const icon = document.getElementById('wakeLockIcon');
    if (!btn || !icon) return;

    if (!isSupported) {
      btn.style.opacity = '0.5';
      btn.title = 'Scherm-wakker houden niet ondersteund in deze browser';
      return;
    }
    if (isActive) {
      btn.classList.add('active-status');
      icon.textContent = '💡';
      btn.title = 'Scherm blijft aan (Actief)';
    } else {
      btn.classList.remove('active-status');
      icon.textContent = '🌙';
      btn.title = 'Scherm kan dimmen (Klik om aan te zetten)';
    }
  }

  // Time Formatter: hh:mm:ss or mm:ss
  function formatTime(ms) {
    if (ms < 0) ms = 0;
    const totalSecs = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    const pad = (n) => String(n).padStart(2, '0');
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  }

  // Generate Official Billiard Ball Badges for numbers
  function renderBallNumber(num) {
    const ballIdx = ((num - 1) % 15) + 1;
    const colorInfo = BALL_COLORS[ballIdx] || { bg: '#333', text: '#fff' };
    return `<span class="ball-badge" style="background:${colorInfo.bg}; color:${colorInfo.text};">${num}</span>`;
  }

  // Timer Tick
  function timerTick() {
    const now = Date.now();
    const elapsed = now - (state.timer.lastTickTs || now);
    state.timer.lastTickTs = now;
    state.timer.remainingMs -= elapsed;

    if (state.timer.remainingMs <= 0) {
      state.timer.remainingMs = 0;
      pauseTimer();
      playTimeUpChimes();
      triggerHaptic(200);
      showToast('⏰ Tijd is op!', '⏰');
    }
    updateTimerUI();
  }

  function startTimer() {
    if (state.timer.isRunning) return;
    if (state.timer.remainingMs <= 0) {
      state.timer.remainingMs = state.timer.totalMs;
    }
    state.timer.isRunning = true;
    state.timer.lastTickTs = Date.now();
    state.timer.intervalId = setInterval(timerTick, 250);
    if (state.settings.wakeLockEnabled) {
      toggleWakeLock(true);
    }
    updateTimerUI();
  }

  function pauseTimer() {
    if (!state.timer.isRunning) return;
    state.timer.isRunning = false;
    clearInterval(state.timer.intervalId);
    state.timer.intervalId = null;
    updateTimerUI();
  }

  function toggleTimer() {
    if (state.timer.isRunning) {
      pauseTimer();
      showToast('Timer gepauzeerd', '⏸️');
    } else {
      startTimer();
      showToast('Timer gestart', '▶️');
    }
  }

  function resetTimer() {
    pauseTimer();
    state.timer.remainingMs = state.timer.totalMs;
    updateTimerUI();
    showToast('Timer gereset', '⟲');
  }

  // Scoring Operations
  function addPoint(playerIdx) {
    if (state.debounceClick) return;
    state.debounceClick = true;
    setTimeout(() => { state.debounceClick = false; }, 160);

    const player = state.players[playerIdx];
    player.score++;
    state.roundNumber++;

    state.liveTimeline.push({
      id: Date.now(),
      playerIdx,
      action: 'point',
      roundNum: state.roundNumber - 1,
      time: new Date()
    });

    playBallClackSound();
    triggerHaptic(25);
    announceScore();
    updateUI();
    showToast(`${player.emoji} ${player.name} +1 Punt`, '🎱');
  }

  function undoPoint(playerIdx) {
    if (state.debounceClick) return;
    state.debounceClick = true;
    setTimeout(() => { state.debounceClick = false; }, 160);

    // Find the last event for this player, or last event globally
    let targetIdx = -1;
    for (let i = state.liveTimeline.length - 1; i >= 0; i--) {
      if (playerIdx === null || state.liveTimeline[i].playerIdx === playerIdx) {
        targetIdx = i;
        break;
      }
    }

    if (targetIdx === -1) {
      showToast('Geen punten om te herstellen', '⚠️');
      return;
    }

    const removed = state.liveTimeline.splice(targetIdx, 1)[0];
    const player = state.players[removed.playerIdx];

    if (removed.action === 'point') {
      player.score = Math.max(0, player.score - 1);
    } else if (removed.action === 'eightball') {
      player.fouls.eightball = Math.max(0, player.fouls.eightball - 1);
      // If penalty point was awarded to opponent, subtract it
      const oppIdx = removed.playerIdx === 0 ? 1 : 0;
      if (state.eightballPenalty > 0) {
        state.players[oppIdx].score = Math.max(0, state.players[oppIdx].score - state.eightballPenalty);
      }
    } else if (removed.action === 'whiteball') {
      player.fouls.whiteball = Math.max(0, player.fouls.whiteball - 1);
    }

    state.roundNumber = Math.max(1, state.roundNumber - 1);
    playChalkUndoSound();
    triggerHaptic(30);
    updateUI();
    showToast(`Laatste actie hersteld 🪶`, '↶');
  }

  function recordEightBallFoul(playerIdx) {
    if (state.debounceClick) return;
    state.debounceClick = true;
    setTimeout(() => { state.debounceClick = false; }, 160);

    const player = state.players[playerIdx];
    const opponent = state.players[playerIdx === 0 ? 1 : 0];

    player.fouls.eightball++;
    if (state.eightballPenalty > 0) {
      opponent.score += state.eightballPenalty;
    }
    state.roundNumber++;

    state.liveTimeline.push({
      id: Date.now(),
      playerIdx,
      action: 'eightball',
      roundNum: state.roundNumber - 1,
      time: new Date()
    });

    playFoulSound();
    triggerHaptic([40, 40, 40]);
    updateUI();
    showToast(`🎱 8-Ball fout van ${player.name}! +${state.eightballPenalty} voor ${opponent.name}`, '⚠️');
  }

  function recordWhiteBallFoul(playerIdx) {
    if (state.debounceClick) return;
    state.debounceClick = true;
    setTimeout(() => { state.debounceClick = false; }, 160);

    const player = state.players[playerIdx];
    player.fouls.whiteball++;

    state.liveTimeline.push({
      id: Date.now(),
      playerIdx,
      action: 'whiteball',
      roundNum: state.roundNumber,
      time: new Date()
    });

    playFoulSound();
    triggerHaptic(40);
    updateUI();
    showToast(`⚪ Speelbal fout van ${player.name} (Scratch)`, '⚪');
  }

  // End Rack / Start New Rack
  function startNewRack(confirmPrompt = true) {
    if (confirmPrompt && (state.players[0].score > 0 || state.players[1].score > 0)) {
      if (!confirm('Nieuw potje starten? De scores voor dit potje worden gereset.')) return;
    }

    state.players[0].score = 0;
    state.players[1].score = 0;
    state.players[0].fouls = { eightball: 0, whiteball: 0 };
    state.players[1].fouls = { eightball: 0, whiteball: 0 };
    state.roundNumber = 1;
    state.liveTimeline = [];

    if (state.timer.autoReset) {
      resetTimer();
    }
    updateUI();
    showToast('🆕 Nieuw potje gestart!', '🎱');
  }

  // End Match & Log to History
  function endMatch() {
    const p1 = state.players[0];
    const p2 = state.players[1];

    if (p1.score === 0 && p2.score === 0 && p1.wins === 0 && p2.wins === 0) {
      showToast('Nog geen scores om op te slaan', '⚠️');
      return;
    }

    let winnerName = 'Gelijkspel';
    let winnerIdx = -1;

    if (p1.score > p2.score) {
      winnerName = p1.name;
      winnerIdx = 0;
      p1.wins++;
    } else if (p2.score > p1.score) {
      winnerName = p2.name;
      winnerIdx = 1;
      p2.wins++;
    }

    // Save match entry
    const matchRecord = {
      id: Date.now(),
      date: new Date().toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' }),
      player1: p1.name,
      player2: p2.name,
      emoji1: p1.emoji,
      emoji2: p2.emoji,
      score1: p1.score,
      score2: p2.score,
      fouls1: { ...p1.fouls },
      fouls2: { ...p2.fouls },
      winner: winnerName,
      winnerIdx,
      competitionStand: [p1.wins, p2.wins],
      gameMode: state.gameMode
    };

    state.gameHistory.unshift(matchRecord);
    saveState();
    playVictoryFanfare();
    triggerHaptic(100);

    // Check if tournament target reached
    const maxWins = Math.max(p1.wins, p2.wins);
    if (state.targetWins > 0 && maxWins >= state.targetWins && winnerIdx !== -1) {
      showChampionModal(state.players[winnerIdx]);
    } else {
      alert(`🏁 Wedstrijd Voltooid!\n\n${p1.emoji} ${p1.name}: ${p1.score}\n${p2.emoji} ${p2.name}: ${p2.score}\n\n🏆 Winnaar: ${winnerName}\n💪 Competitiestand: ${p1.wins} - ${p2.wins}`);
    }

    startNewRack(false);
  }

  // Champion Celebration Modal
  function showChampionModal(champion) {
    const modal = document.getElementById('championModal');
    const title = document.getElementById('championTitle');
    const subtitle = document.getElementById('championSubtitle');
    const scoreFinal = document.getElementById('championScoreFinal');

    if (title) title.textContent = `${champion.emoji} ${champion.name} is Kampioen!`;
    if (subtitle) subtitle.textContent = `Heeft als eerste ${state.targetWins} potjes gewonnen!`;
    if (scoreFinal) scoreFinal.textContent = `Eindstand: ${state.players[0].name} ${state.players[0].wins} - ${state.players[1].wins} ${state.players[1].name}`;

    if (modal) modal.classList.add('open');
  }

  // Share Game Result via Web Share API or Clipboard
  function shareGame(matchIdx) {
    const match = state.gameHistory[matchIdx];
    if (!match) return;

    const shareText = `🎱 Pool & Biljart Score:\n${match.emoji1} ${match.player1} ${match.score1} - ${match.score2} ${match.player2} ${match.emoji2}\n🏆 Winnaar: ${match.winner}!\n💪 Competitiestand: ${match.competitionStand[0]} - ${match.competitionStand[1]}\n📅 ${match.date}`;

    if (navigator.share) {
      navigator.share({
        title: 'Pool Wedstrijd Uitslag',
        text: shareText
      }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText).then(() => {
        showToast('Uitslag gekopieerd naar klembord! 📋', '📤');
      });
    } else {
      alert(shareText);
    }
  }

  // Delete Individual Game from History
  function deleteHistoryGame(matchIdx) {
    if (!confirm('Weet je zeker dat je deze wedstrijd wilt verwijderen?')) return;
    state.gameHistory.splice(matchIdx, 1);
    saveState();
    renderHistoryModal();
    showToast('Wedstrijd verwijderd', '🗑️');
  }

  // Save / Load State to LocalStorage
  function saveState() {
    try {
      const dataToSave = {
        players: state.players,
        roundNumber: state.roundNumber,
        targetWins: state.targetWins,
        gameMode: state.gameMode,
        eightballPenalty: state.eightballPenalty,
        timerTotalMs: state.timer.totalMs,
        timerAutoReset: state.timer.autoReset,
        liveTimeline: state.liveTimeline,
        gameHistory: state.gameHistory,
        settings: state.settings
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (e) {}
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.players) state.players = parsed.players;
        if (parsed.roundNumber) state.roundNumber = parsed.roundNumber;
        if (parsed.targetWins !== undefined) state.targetWins = parsed.targetWins;
        if (parsed.gameMode) state.gameMode = parsed.gameMode;
        if (parsed.eightballPenalty !== undefined) state.eightballPenalty = parsed.eightballPenalty;
        if (parsed.timerTotalMs) {
          state.timer.totalMs = parsed.timerTotalMs;
          state.timer.remainingMs = parsed.timerTotalMs;
        }
        if (parsed.timerAutoReset !== undefined) state.timer.autoReset = parsed.timerAutoReset;
        if (parsed.liveTimeline) state.liveTimeline = parsed.liveTimeline;
        if (parsed.gameHistory) state.gameHistory = parsed.gameHistory;
        if (parsed.settings) state.settings = Object.assign(state.settings, parsed.settings);
      }
    } catch (e) {}
  }

  // Update All UI Elements
  function updateUI() {
    const p1 = state.players[0];
    const p2 = state.players[1];

    // Card 1
    const p1Card = document.getElementById('player1Card');
    if (p1Card) p1Card.style.background = COLOR_THEMES[p1.color] || COLOR_THEMES.p1;
    document.getElementById('p1Name').textContent = p1.name;
    document.getElementById('p1Emoji').textContent = p1.emoji;
    document.getElementById('p1Score').textContent = p1.score;
    document.getElementById('p1WinsText').textContent = `${p1.wins} ${p1.wins === 1 ? 'potje' : 'potjes'} gewonnen`;

    // Fouls Card 1
    let p1FoulHtml = '';
    if (p1.fouls.eightball > 0) p1FoulHtml += `<span class="foul-tag">🎱 × ${p1.fouls.eightball}</span>`;
    if (p1.fouls.whiteball > 0) p1FoulHtml += `<span class="foul-tag">⚪ × ${p1.fouls.whiteball}</span>`;
    document.getElementById('p1FoulList').innerHTML = p1FoulHtml;

    // Card 2
    const p2Card = document.getElementById('player2Card');
    if (p2Card) p2Card.style.background = COLOR_THEMES[p2.color] || COLOR_THEMES.p2;
    document.getElementById('p2Name').textContent = p2.name;
    document.getElementById('p2Emoji').textContent = p2.emoji;
    document.getElementById('p2Score').textContent = p2.score;
    document.getElementById('p2WinsText').textContent = `${p2.wins} ${p2.wins === 1 ? 'potje' : 'potjes'} gewonnen`;

    // Fouls Card 2
    let p2FoulHtml = '';
    if (p2.fouls.eightball > 0) p2FoulHtml += `<span class="foul-tag">🎱 × ${p2.fouls.eightball}</span>`;
    if (p2.fouls.whiteball > 0) p2FoulHtml += `<span class="foul-tag">⚪ × ${p2.fouls.whiteball}</span>`;
    document.getElementById('p2FoulList').innerHTML = p2FoulHtml;

    // Tournament Banner
    document.getElementById('tournP1Name').textContent = p1.name;
    document.getElementById('tournP1Wins').textContent = p1.wins;
    document.getElementById('tournP2Name').textContent = p2.name;
    document.getElementById('tournP2Wins').textContent = p2.wins;

    const targetBadge = document.getElementById('tournamentTargetBadge');
    if (targetBadge) {
      targetBadge.textContent = state.targetWins > 0 ? `Doel: ${state.targetWins} potjes` : 'Vrij Spel';
    }

    const modeBadge = document.getElementById('gameModeBadge');
    if (modeBadge) {
      modeBadge.textContent = state.gameMode === 'pool-9ball' ? '🟡 9-Ball' :
                             state.gameMode === 'biljart-libre' ? '🔴⚪ Biljart' : '🎱 8-Ball';
    }

    document.getElementById('headerSubtitle').textContent = `Ronde ${state.roundNumber} • ${state.timer.isRunning ? 'Bezig' : 'Gepauzeerd'}`;

    // Render Timeline
    renderTimeline();

    // Persist
    saveState();
  }

  // Update Timer UI
  function updateTimerUI() {
    const digitsEl = document.getElementById('timerDigits');
    const pillEl = document.getElementById('timerStatusPill');
    const playIcon = document.getElementById('timerPlayIcon');
    const playText = document.getElementById('timerPlayText');

    if (digitsEl) {
      digitsEl.textContent = formatTime(state.timer.remainingMs);
      if (state.timer.remainingMs <= 60000 && state.timer.remainingMs > 0) {
        digitsEl.classList.add('time-warning');
      } else {
        digitsEl.classList.remove('time-warning');
      }
    }

    if (pillEl) {
      if (state.timer.remainingMs === 0) {
        pillEl.textContent = 'Tijd op!';
        pillEl.className = 'timer-status-pill';
        pillEl.style.background = 'rgba(239, 68, 68, 0.2)';
        pillEl.style.color = '#f87171';
      } else if (state.timer.isRunning) {
        pillEl.textContent = 'Lopend';
        pillEl.className = 'timer-status-pill running';
      } else {
        pillEl.textContent = 'Gepauzeerd';
        pillEl.className = 'timer-status-pill paused';
      }
    }

    if (playIcon && playText) {
      playIcon.textContent = state.timer.isRunning ? '⏸️' : '▶️';
      playText.textContent = state.timer.isRunning ? 'Pauze' : 'Start';
    }
  }

  // Render Live Timeline Pills
  function renderTimeline() {
    const container = document.getElementById('liveTimelineScroll');
    const countEl = document.getElementById('timelineCountText');
    if (!container) return;

    if (state.liveTimeline.length === 0) {
      container.innerHTML = `<div style="color: var(--text-muted); font-size: 12px; padding: 4px 0;">Nog geen punten gescoord in dit potje...</div>`;
      if (countEl) countEl.textContent = '0 gebeurtenissen';
      return;
    }

    if (countEl) countEl.textContent = `${state.liveTimeline.length} ${state.liveTimeline.length === 1 ? 'gebeurtenis' : 'gebeurtenissen'}`;

    let html = '';
    state.liveTimeline.forEach((ev, idx) => {
      const player = state.players[ev.playerIdx];
      const cls = ev.playerIdx === 0 ? 'p1' : 'p2';
      let icon = '+1';
      if (ev.action === 'eightball') icon = '🎱 8-ball';
      if (ev.action === 'whiteball') icon = '⚪ scratch';

      const ballBadge = renderBallNumber(idx + 1);

      html += `
        <div class="timeline-pill ${cls}">
          <span class="pill-round-num">${ballBadge}</span>
          <span>${player.emoji} ${icon}</span>
        </div>
      `;
    });

    container.innerHTML = html;
    container.scrollLeft = container.scrollWidth;
  }

  // Render Match History Modal
  function renderHistoryModal() {
    const p1 = state.players[0];
    const p2 = state.players[1];

    document.getElementById('statsP1Wins').textContent = p1.wins;
    document.getElementById('statsP1Label').textContent = `${p1.emoji} ${p1.name}`;
    document.getElementById('statsP2Wins').textContent = p2.wins;
    document.getElementById('statsP2Label').textContent = `${p2.emoji} ${p2.name}`;
    document.getElementById('statsTotalGames').textContent = state.gameHistory.length;

    const list = document.getElementById('pastMatchesList');
    if (!list) return;

    if (state.gameHistory.length === 0) {
      list.innerHTML = `<div style="text-align: center; padding: 28px; color: var(--text-muted);">Nog geen wedstrijden gespeeld. Speel een potje en klik op "Einde Match"!</div>`;
      return;
    }

    let html = '';
    state.gameHistory.forEach((game, idx) => {
      const ballBadge = renderBallNumber(state.gameHistory.length - idx);
      html += `
        <div class="history-match-item">
          <div class="history-match-top">
            <div class="history-match-title">
              ${ballBadge}
              <span>${game.emoji1} ${game.player1} <strong style="font-size:16px;">${game.score1} - ${game.score2}</strong> ${game.player2} ${game.emoji2}</span>
            </div>
            <div class="history-actions">
              <button class="history-action-btn" onclick="window.shareHistoryGame(${idx})">📤 Deel</button>
              <button class="history-action-btn" onclick="window.deleteHistoryGameItem(${idx})" style="color: #f87171;">🗑️</button>
            </div>
          </div>
          <div class="history-match-winner">🏆 Winnaar: ${game.winner}</div>
          <div class="history-match-details">
            📅 ${game.date} • Stand toen: ${game.competitionStand ? `${game.competitionStand[0]} - ${game.competitionStand[1]}` : ''}
          </div>
        </div>
      `;
    });

    list.innerHTML = html;
  }

  // Player Edit Modal Setup
  function openPlayerModal(playerIdx) {
    state.editingPlayerIdx = playerIdx;
    const player = state.players[playerIdx];

    document.getElementById('playerModalTitle').textContent = `${player.name} Aanpassen`;
    document.getElementById('editPlayerNameInput').value = player.name;

    // Populate Emoji Picker
    const emojiGrid = document.getElementById('emojiPickerGrid');
    emojiGrid.innerHTML = '';
    EMOJIS.forEach((emoji) => {
      const btn = document.createElement('button');
      btn.className = `emoji-choice-btn ${emoji === player.emoji ? 'selected' : ''}`;
      btn.textContent = emoji;
      btn.type = 'button';
      btn.onclick = () => {
        document.querySelectorAll('.emoji-choice-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      };
      emojiGrid.appendChild(btn);
    });

    // Populate Color Picker
    const colorGrid = document.getElementById('colorPickerGrid');
    colorGrid.innerHTML = '';
    Object.keys(COLOR_THEMES).forEach((colorKey) => {
      const btn = document.createElement('button');
      btn.className = `color-choice-btn ${colorKey === player.color ? 'selected' : ''}`;
      btn.style.background = COLOR_THEMES[colorKey];
      btn.type = 'button';
      btn.dataset.color = colorKey;
      btn.onclick = () => {
        document.querySelectorAll('.color-choice-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      };
      colorGrid.appendChild(btn);
    });

    document.getElementById('playerModal').classList.add('open');
  }

  function savePlayerModal() {
    if (state.editingPlayerIdx === null) return;
    const player = state.players[state.editingPlayerIdx];
    const nameInput = document.getElementById('editPlayerNameInput').value.trim();

    if (nameInput) player.name = nameInput;

    const selectedEmoji = document.querySelector('.emoji-choice-btn.selected');
    if (selectedEmoji) player.emoji = selectedEmoji.textContent;

    const selectedColor = document.querySelector('.color-choice-btn.selected');
    if (selectedColor && selectedColor.dataset.color) player.color = selectedColor.dataset.color;

    document.getElementById('playerModal').classList.remove('open');
    state.editingPlayerIdx = null;
    updateUI();
    showToast('Speler opgeslagen', '✅');
  }

  // Timer Preset Helper
  window.setTimerPreset = (minutes) => {
    document.getElementById('timerHoursInput').value = Math.floor(minutes / 60);
    document.getElementById('timerMinutesInput').value = minutes % 60;
    document.getElementById('timerSecondsInput').value = 0;
  };

  // Global window functions for modal buttons
  window.shareHistoryGame = (idx) => shareGame(idx);
  window.deleteHistoryGameItem = (idx) => deleteHistoryGame(idx);

  // Fullscreen helper
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }

  // Initialize Event Listeners
  function setupEventListeners() {
    // Player 1 events
    document.getElementById('p1HeaderBtn').onclick = () => openPlayerModal(0);
    document.getElementById('p1Score').onclick = () => addPoint(0);
    document.getElementById('p1AddPointBtn').onclick = () => addPoint(0);
    document.getElementById('p1UndoPointBtn').onclick = () => undoPoint(0);
    document.getElementById('p1EightballBtn').onclick = () => recordEightBallFoul(0);
    document.getElementById('p1WhiteballBtn').onclick = () => recordWhiteBallFoul(0);

    // Player 2 events
    document.getElementById('p2HeaderBtn').onclick = () => openPlayerModal(1);
    document.getElementById('p2Score').onclick = () => addPoint(1);
    document.getElementById('p2AddPointBtn').onclick = () => addPoint(1);
    document.getElementById('p2UndoPointBtn').onclick = () => undoPoint(1);
    document.getElementById('p2EightballBtn').onclick = () => recordEightBallFoul(1);
    document.getElementById('p2WhiteballBtn').onclick = () => recordWhiteBallFoul(1);

    // Timer controls
    document.getElementById('timerToggleBtn').onclick = () => toggleTimer();
    document.getElementById('timerDigits').onclick = () => toggleTimer();
    document.getElementById('timerResetBtn').onclick = () => resetTimer();
    document.getElementById('globalUndoBtn').onclick = () => undoPoint(null);
    document.getElementById('newRackBtn').onclick = () => startNewRack(true);
    document.getElementById('endMatchBtn').onclick = () => endMatch();

    // Wake Lock button
    document.getElementById('wakeLockBtn').onclick = () => {
      const willEnable = !state.wakeLockSentinel;
      state.settings.wakeLockEnabled = willEnable;
      toggleWakeLock(willEnable);
      saveState();
      showToast(willEnable ? 'Scherm blijft aan tijdens spelen 💡' : 'Scherm kan dimmen 🌙', '💡');
    };

    // Fullscreen button
    document.getElementById('fullscreenBtn').onclick = toggleFullscreen;

    // Header Modals
    document.getElementById('openHistoryBtn').onclick = () => {
      renderHistoryModal();
      document.getElementById('historyModal').classList.add('open');
    };
    document.getElementById('closeHistoryModalBtn').onclick = () => document.getElementById('historyModal').classList.remove('open');
    document.getElementById('closeHistoryModalBtn2').onclick = () => document.getElementById('historyModal').classList.remove('open');

    document.getElementById('clearAllHistoryBtn').onclick = () => {
      if (confirm('Wil je de complete geschiedenis en alle statistieken wissen?')) {
        state.gameHistory = [];
        state.players[0].wins = 0;
        state.players[1].wins = 0;
        saveState();
        renderHistoryModal();
        updateUI();
        showToast('Geschiedenis gewist', '🗑️');
      }
    };

    document.getElementById('openSettingsBtn').onclick = () => {
      document.getElementById('gameModeSelect').value = state.gameMode;
      document.getElementById('tournamentTargetSelect').value = state.targetWins;
      document.getElementById('eightballRuleSelect').value = state.eightballPenalty;
      document.getElementById('autoResetTimerToggle').checked = state.timer.autoReset;
      document.getElementById('wakeLockSettingToggle').checked = state.settings.wakeLockEnabled;
      document.getElementById('settingsModal').classList.add('open');
    };
    document.getElementById('closeSettingsModalBtn').onclick = () => document.getElementById('settingsModal').classList.remove('open');
    document.getElementById('cancelSettingsModalBtn').onclick = () => document.getElementById('settingsModal').classList.remove('open');
    document.getElementById('saveSettingsModalBtn').onclick = () => {
      state.gameMode = document.getElementById('gameModeSelect').value;
      state.targetWins = parseInt(document.getElementById('tournamentTargetSelect').value, 10);
      state.eightballPenalty = parseInt(document.getElementById('eightballRuleSelect').value, 10);
      state.timer.autoReset = document.getElementById('autoResetTimerToggle').checked;
      state.settings.wakeLockEnabled = document.getElementById('wakeLockSettingToggle').checked;
      toggleWakeLock(state.settings.wakeLockEnabled);
      document.getElementById('settingsModal').classList.remove('open');
      updateUI();
      showToast('Instellingen opgeslagen', '✅');
    };

    // Timer modal
    document.getElementById('openTimerModalBtn').onclick = () => {
      const totalSecs = Math.floor(state.timer.totalMs / 1000);
      document.getElementById('timerHoursInput').value = Math.floor(totalSecs / 3600);
      document.getElementById('timerMinutesInput').value = Math.floor((totalSecs % 3600) / 60);
      document.getElementById('timerSecondsInput').value = totalSecs % 60;
      document.getElementById('soundMasterToggle').checked = state.settings.soundMaster;
      document.getElementById('voiceAnnounceToggle').checked = state.settings.voiceAnnounce;
      document.getElementById('hapticToggle').checked = state.settings.hapticEnabled;
      document.getElementById('soundVolumeSlider').value = state.settings.soundVolume;
      document.getElementById('timerModal').classList.add('open');
    };
    document.getElementById('closeTimerModalBtn').onclick = () => document.getElementById('timerModal').classList.remove('open');
    document.getElementById('cancelTimerModalBtn').onclick = () => document.getElementById('timerModal').classList.remove('open');
    document.getElementById('saveTimerModalBtn').onclick = () => {
      const hrs = Math.max(0, parseInt(document.getElementById('timerHoursInput').value, 10) || 0);
      const mins = Math.max(0, Math.min(59, parseInt(document.getElementById('timerMinutesInput').value, 10) || 0));
      const secs = Math.max(0, Math.min(59, parseInt(document.getElementById('timerSecondsInput').value, 10) || 0));
      const newTotalMs = ((hrs * 3600) + (mins * 60) + secs) * 1000;

      if (newTotalMs > 0) {
        state.timer.totalMs = newTotalMs;
        state.timer.remainingMs = newTotalMs;
      }

      state.settings.soundMaster = document.getElementById('soundMasterToggle').checked;
      state.settings.voiceAnnounce = document.getElementById('voiceAnnounceToggle').checked;
      state.settings.hapticEnabled = document.getElementById('hapticToggle').checked;
      state.settings.soundVolume = parseInt(document.getElementById('soundVolumeSlider').value, 10);

      document.getElementById('timerModal').classList.remove('open');
      updateTimerUI();
      saveState();
      showToast('Timer & geluid aangepast', '⏱️');
    };

    // Player edit modal buttons
    document.getElementById('closePlayerModalBtn').onclick = () => document.getElementById('playerModal').classList.remove('open');
    document.getElementById('cancelPlayerModalBtn').onclick = () => document.getElementById('playerModal').classList.remove('open');
    document.getElementById('savePlayerModalBtn').onclick = savePlayerModal;

    // Champion Modal
    document.getElementById('closeChampionModalBtn').onclick = () => {
      document.getElementById('championModal').classList.remove('open');
    };

    // Android PWA Install button & Modal
    const installBtn = document.getElementById('installAppBtn');
    const installModal = document.getElementById('androidInstallModal');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      state.deferredInstallPrompt = e;
      if (installBtn) installBtn.style.display = 'inline-flex';
    });

    installBtn.onclick = () => {
      if (state.deferredInstallPrompt) {
        state.deferredInstallPrompt.prompt();
        state.deferredInstallPrompt.userChoice.then((choice) => {
          if (choice.outcome === 'accepted') {
            installBtn.style.display = 'none';
          }
          state.deferredInstallPrompt = null;
        });
      } else {
        installModal.classList.add('open');
      }
    };

    document.getElementById('closeInstallModalBtn').onclick = () => installModal.classList.remove('open');
    document.getElementById('closeInstallModalBtn2').onclick = () => installModal.classList.remove('open');
    document.getElementById('confirmInstallPromptBtn').onclick = () => {
      if (state.deferredInstallPrompt) {
        state.deferredInstallPrompt.prompt();
      }
      installModal.classList.remove('open');
    };

    // Export & Import
    document.getElementById('exportDataBtn').onclick = () => {
      const exportJson = JSON.stringify(state, null, 2);
      const blob = new Blob([exportJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pool_scoreboard_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Backup gedownload! 💾', '✅');
    };

    const importInput = document.getElementById('importFileInput');
    document.getElementById('importDataBtn').onclick = () => importInput.click();
    importInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          if (imported.players) state.players = imported.players;
          if (imported.gameHistory) state.gameHistory = imported.gameHistory;
          if (imported.targetWins) state.targetWins = imported.targetWins;
          saveState();
          updateUI();
          showToast('Gegevens succesvol geïmporteerd! 📥', '✅');
        } catch (err) {
          alert('Fout bij het lezen van het JSON backup-bestand.');
        }
      };
      reader.readAsText(file);
    };

    // Backdrop click close for modals
    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) backdrop.classList.remove('open');
      });
    });

    // Re-acquire Wake Lock when window regains focus
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && state.settings.wakeLockEnabled && state.timer.isRunning) {
        toggleWakeLock(true);
      }
    });

    // Register Service Worker for Android PWA offline support
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      });
    }
  }

  // Boot Application
  function init() {
    loadState();
    setupEventListeners();
    updateUI();
    updateTimerUI();

    if (state.settings.wakeLockEnabled) {
      toggleWakeLock(true);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
