(() => {
  'use strict';

  const WIDTH = 480;
  const HEIGHT = 720;
  const GROUND_Y = 620;
  const PIPE_WIDTH = 78;
  const PIPE_GAP = 184;
  const PIPE_SPACING = 282;
  const BIRD_X = 132;
  const BIRD_RADIUS = 17;
  const GRAVITY = 1420;
  const FLAP_VELOCITY = -440;
  const STORAGE_KEY = 'flappie-bird-best-v1';

  const canvas = document.querySelector('#game-canvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.querySelector('#game-overlay');
  const title = document.querySelector('#overlay-title');
  const kicker = document.querySelector('#overlay-kicker');
  const copy = document.querySelector('#overlay-copy');
  const playButton = document.querySelector('#play-button');
  const playButtonLabel = document.querySelector('#play-button-label');
  const pauseButton = document.querySelector('#pause-button');
  const soundButton = document.querySelector('#sound-button');
  const scoreDisplay = document.querySelector('#score-display');
  const scoreNote = document.querySelector('#score-note-text');
  const bestValue = document.querySelector('#best-value');

  let state = 'ready';
  let bird = { y: 328, velocity: 0, rotation: 0 };
  let pipes = [];
  let score = 0;
  let best = loadBest();
  let lastFrame = 0;
  let elapsed = 0;
  let groundOffset = 0;
  let soundEnabled = true;
  let audioContext = null;
  let particles = [];
  let shake = 0;

  const clouds = [
    { x: 62, y: 115, scale: .8, speed: 7 },
    { x: 339, y: 202, scale: .63, speed: 10 },
    { x: 207, y: 75, scale: .48, speed: 5 },
    { x: 445, y: 310, scale: .72, speed: 8 }
  ];

  bestValue.textContent = String(best);
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas, { passive: true });

  function loadBest() {
    try {
      const stored = Number.parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
      return Number.isFinite(stored) && stored > 0 ? stored : 0;
    } catch {
      return 0;
    }
  }

  function saveBest() {
    try { localStorage.setItem(STORAGE_KEY, String(best)); } catch { /* Storage can be disabled. */ }
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
    draw();
  }

  function resetRun() {
    score = 0;
    pipes = [];
    particles = [];
    bird = { y: 328, velocity: 0, rotation: 0 };
    pipes.push(makePipe(WIDTH + 90));
    pipes.push(makePipe(WIDTH + 90 + PIPE_SPACING));
    scoreDisplay.textContent = '0';
    scoreDisplay.classList.remove('visible');
    scoreNote.textContent = 'Easy does it. One flap at a time.';
  }

  function makePipe(x) {
    const marginTop = 68;
    const marginBottom = 114;
    const center = marginTop + PIPE_GAP / 2 + Math.random() * (GROUND_Y - marginBottom - marginTop - PIPE_GAP);
    return { x, center, scored: false };
  }

  function startGame() {
    ensureAudio();
    resetRun();
    state = 'playing';
    overlay.classList.add('hidden');
    pauseButton.disabled = false;
    scoreDisplay.classList.add('visible');
    flap();
  }

  function endGame() {
    if (state !== 'playing') return;
    state = 'gameover';
    pauseButton.disabled = true;
    playSound(120, .18, 'triangle', .07);
    burst(BIRD_X + 5, bird.y, 12);
    shake = 8;
    const newRecord = score > best;
    if (newRecord) {
      best = score;
      bestValue.textContent = String(best);
      saveBest();
    }
    kicker.textContent = score > 0 ? 'NICE FLIGHT, BIRDIE' : 'THE SKY IS YOURS';
    title.innerHTML = score > 0 ? `You flew<br><span class="result-score">${score}</span> ${score === 1 ? 'pipe' : 'pipes'}.` : 'One more<br>little try?';
    copy.textContent = newRecord ? 'A new personal best! That one’s going in the storybook.' : score > 0 ? 'A little farther next time. Your wings are warming up.' : 'Every great pilot starts somewhere.';
    playButtonLabel.textContent = 'FLY AGAIN';
    overlay.classList.remove('hidden');
    scoreNote.textContent = score > 0 ? `A lovely little flight. ${score} ${score === 1 ? 'pipe' : 'pipes'} cleared.` : 'No worries. The sky will wait.';
  }

  function flap() {
    if (state === 'ready') {
      startGame();
      return;
    }
    if (state !== 'playing') return;
    bird.velocity = FLAP_VELOCITY;
    bird.rotation = -.42;
    burst(BIRD_X - 15, bird.y + 4, 3, true);
    playSound(540, .075, 'sine', .035);
  }

  function pauseGame() {
    if (state === 'playing') {
      state = 'paused';
      kicker.textContent = 'TAKE YOUR TIME';
      title.innerHTML = 'Wings at<br>rest.';
      copy.textContent = 'Catch your breath, then pick up where you left off.';
      playButtonLabel.textContent = 'KEEP FLYING';
      overlay.classList.remove('hidden');
      pauseButton.setAttribute('aria-label', 'Resume game');
      pauseButton.title = 'Resume (P)';
    } else if (state === 'paused') {
      state = 'playing';
      overlay.classList.add('hidden');
      pauseButton.setAttribute('aria-label', 'Pause game');
      pauseButton.title = 'Pause (P)';
    }
  }

  function setSound(enabled) {
    soundEnabled = enabled;
    soundButton.setAttribute('aria-pressed', String(enabled));
    soundButton.setAttribute('aria-label', enabled ? 'Turn sound off' : 'Turn sound on');
    soundButton.title = enabled ? 'Turn sound off (M)' : 'Turn sound on (M)';
    if (enabled) ensureAudio();
  }

  function ensureAudio() {
    if (!soundEnabled || audioContext) return;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    try { audioContext = new AudioCtor(); } catch { audioContext = null; }
  }

  function playSound(frequency, duration, type, volume) {
    if (!soundEnabled) return;
    ensureAudio();
    if (!audioContext) return;
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(60, frequency * .72), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  function burst(x, y, count, tiny = false) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = tiny ? 22 + Math.random() * 45 : 55 + Math.random() * 135;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (tiny ? 0 : 25),
        life: tiny ? .25 + Math.random() * .2 : .35 + Math.random() * .4,
        maxLife: tiny ? .45 : .75,
        size: tiny ? 2 + Math.random() * 2 : 3 + Math.random() * 4,
        color: ['#fff5cf', '#ed7659', '#f8c464', '#e5f0d2'][Math.floor(Math.random() * 4)]
      });
    }
  }

  function update(dt) {
    elapsed += dt;
    if (state === 'playing') {
      bird.velocity += GRAVITY * dt;
      bird.y += bird.velocity * dt;
      bird.rotation = Math.min(.95, Math.max(-.5, bird.velocity / 620));

      for (const pipe of pipes) {
        pipe.x -= 195 * dt;
        const topBottom = pipe.center - PIPE_GAP / 2;
        const bottomTop = pipe.center + PIPE_GAP / 2;
        const birdLeft = BIRD_X - BIRD_RADIUS + 2;
        const birdRight = BIRD_X + BIRD_RADIUS - 2;
        const birdTop = bird.y - BIRD_RADIUS + 3;
        const birdBottom = bird.y + BIRD_RADIUS - 3;
        if (birdRight > pipe.x && birdLeft < pipe.x + PIPE_WIDTH && (birdTop < topBottom || birdBottom > bottomTop)) {
          endGame();
          break;
        }
        if (!pipe.scored && pipe.x + PIPE_WIDTH < BIRD_X) {
          pipe.scored = true;
          score++;
          scoreDisplay.textContent = String(score);
          scoreNote.textContent = score >= 10 ? 'Look at you go! Those wings are magic.' : 'Lovely flying. Keep that rhythm.';
          playSound(760, .11, 'sine', .045);
        }
      }
      if (bird.y - BIRD_RADIUS < 0 || bird.y + BIRD_RADIUS > GROUND_Y) endGame();

      pipes = pipes.filter(pipe => pipe.x + PIPE_WIDTH > -5);
      if (pipes.length < 3) {
        const lastPipe = pipes[pipes.length - 1];
        pipes.push(makePipe(lastPipe ? lastPipe.x + PIPE_SPACING : WIDTH + 65));
      }
      groundOffset = (groundOffset + 195 * dt) % 48;
    } else if (state === 'ready') {
      bird.y = 328 + Math.sin(elapsed * 2.3) * 8;
      bird.rotation = Math.sin(elapsed * 2.3) * .035;
      groundOffset = (groundOffset + 15 * dt) % 48;
    } else if (state === 'gameover') {
      if (bird.y + BIRD_RADIUS < GROUND_Y) {
        bird.velocity += GRAVITY * dt;
        bird.y = Math.min(GROUND_Y - BIRD_RADIUS, bird.y + bird.velocity * dt);
        bird.rotation = Math.min(1.25, bird.rotation + dt * 1.1);
      }
      groundOffset = (groundOffset + 32 * dt) % 48;
    }

    for (const particle of particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 210 * dt;
      particle.life -= dt;
    }
    particles = particles.filter(particle => particle.life > 0);
    shake = Math.max(0, shake - 36 * dt);
  }

  function draw() {
    if (!ctx) return;
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
    drawSky();
    drawHills();
    drawClouds();
    for (const pipe of pipes) drawPipe(pipe);
    drawBird();
    drawParticles();
    drawGround();
    ctx.restore();
  }

  function drawSky() {
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, '#8edbd5');
    sky.addColorStop(.48, '#b9e6cc');
    sky.addColorStop(1, '#f6dfa6');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.save();
    ctx.globalAlpha = .68;
    ctx.fillStyle = '#ffe9a3';
    ctx.beginPath();
    ctx.arc(379, 142, 43, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = .12;
    ctx.beginPath();
    ctx.arc(379, 142, 59, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Fine, warm grain gives the sky a printed-paper feel.
    ctx.save();
    ctx.globalAlpha = .12;
    for (let i = 0; i < 76; i++) {
      const x = ((i * 83 + 17) % WIDTH);
      const y = ((i * 137 + 31) % (GROUND_Y - 30));
      ctx.fillStyle = i % 3 ? '#fff9dc' : '#528f84';
      ctx.fillRect(x, y, i % 4 === 0 ? 2 : 1, 1);
    }
    ctx.restore();
  }

  function drawHills() {
    ctx.fillStyle = '#a0c6a0';
    ctx.beginPath();
    ctx.moveTo(0, 467);
    ctx.bezierCurveTo(74, 427, 113, 466, 175, 452);
    ctx.bezierCurveTo(238, 438, 264, 402, 327, 431);
    ctx.bezierCurveTo(390, 457, 422, 430, 480, 444);
    ctx.lineTo(480, GROUND_Y); ctx.lineTo(0, GROUND_Y); ctx.closePath(); ctx.fill();

    ctx.fillStyle = '#78ad91';
    ctx.beginPath();
    ctx.moveTo(0, 521);
    ctx.bezierCurveTo(57, 492, 109, 503, 166, 520);
    ctx.bezierCurveTo(230, 540, 276, 485, 338, 503);
    ctx.bezierCurveTo(392, 519, 437, 490, 480, 512);
    ctx.lineTo(480, GROUND_Y); ctx.lineTo(0, GROUND_Y); ctx.closePath(); ctx.fill();

    // Tiny distant rooftops.
    ctx.fillStyle = 'rgba(69, 126, 111, .32)';
    [[35, 24, 32], [78, 18, 43], [105, 25, 30], [375, 23, 37], [416, 19, 32], [444, 28, 45]].forEach(([x, w, h]) => {
      ctx.fillRect(x, 576 - h, w, h);
      ctx.fillRect(x + 8, 568 - h, 5, 9);
    });
  }

  function drawClouds() {
    ctx.save();
    for (const cloud of clouds) {
      const drift = (elapsed * cloud.speed) % (WIDTH + 120);
      const x = (cloud.x - drift + WIDTH + 60) % (WIDTH + 120) - 60;
      drawCloud(x, cloud.y, cloud.scale);
    }
    ctx.restore();
  }

  function drawCloud(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(255, 252, 226, .75)';
    ctx.beginPath();
    ctx.ellipse(0, 10, 37, 11, 0, 0, Math.PI * 2);
    ctx.ellipse(-17, 5, 17, 14, 0, 0, Math.PI * 2);
    ctx.ellipse(1, -4, 22, 21, 0, 0, Math.PI * 2);
    ctx.ellipse(22, 4, 17, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPipe(pipe) {
    const topEnd = pipe.center - PIPE_GAP / 2;
    const bottomStart = pipe.center + PIPE_GAP / 2;
    drawPipeBody(pipe.x, 0, topEnd, true);
    drawPipeBody(pipe.x, bottomStart, GROUND_Y - bottomStart, false);
  }

  function drawPipeBody(x, y, height, top) {
    const lipHeight = 23;
    const bodyY = top ? 0 : y + lipHeight;
    const bodyHeight = height - lipHeight;
    if (bodyHeight <= 0) return;
    const gradient = ctx.createLinearGradient(x, 0, x + PIPE_WIDTH, 0);
    gradient.addColorStop(0, '#367e68');
    gradient.addColorStop(.16, '#65a879');
    gradient.addColorStop(.52, '#82bb81');
    gradient.addColorStop(1, '#4c956e');
    ctx.fillStyle = gradient;
    ctx.strokeStyle = '#315d53';
    ctx.lineWidth = 3;
    roundRect(x + 4, bodyY, PIPE_WIDTH - 8, bodyHeight, top ? [0, 0, 8, 8] : [8, 8, 0, 0]);
    ctx.fill(); ctx.stroke();

    // A light stripe and small rivets give the pipes a hand-painted finish.
    ctx.globalAlpha = .34;
    ctx.strokeStyle = '#d5e8a5';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const stripeX = x + 18;
    ctx.moveTo(stripeX, bodyY + (top ? 10 : 2));
    ctx.lineTo(stripeX, bodyY + bodyHeight - (top ? 3 : 10));
    ctx.stroke();
    ctx.globalAlpha = 1;

    const lipY = top ? y + height - lipHeight : y;
    const lipGradient = ctx.createLinearGradient(x - 4, 0, x + PIPE_WIDTH + 4, 0);
    lipGradient.addColorStop(0, '#397c67');
    lipGradient.addColorStop(.18, '#75b27b');
    lipGradient.addColorStop(.58, '#91c783');
    lipGradient.addColorStop(1, '#4c926c');
    ctx.fillStyle = lipGradient;
    ctx.strokeStyle = '#315d53';
    ctx.lineWidth = 3;
    roundRect(x - 4, lipY, PIPE_WIDTH + 8, lipHeight, 7);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(215, 238, 170, .48)';
    roundRect(x + 4, lipY + 4, 8, lipHeight - 8, 4);
    ctx.fill();

    if (height > 65) {
      ctx.fillStyle = '#d3e39e';
      ctx.beginPath();
      ctx.arc(x + PIPE_WIDTH - 13, lipY + 11, 2, 0, Math.PI * 2);
      ctx.arc(x + PIPE_WIDTH - 13, lipY + 17, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function roundRect(x, y, width, height, radii) {
    let [tl, tr, br, bl] = Array.isArray(radii) ? radii : [radii, radii, radii, radii];
    tl = Math.min(tl, width / 2, height / 2);
    tr = Math.min(tr, width / 2, height / 2);
    br = Math.min(br, width / 2, height / 2);
    bl = Math.min(bl, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + width - tr, y); ctx.quadraticCurveTo(x + width, y, x + width, y + tr);
    ctx.lineTo(x + width, y + height - br); ctx.quadraticCurveTo(x + width, y + height, x + width - br, y + height);
    ctx.lineTo(x + bl, y + height); ctx.quadraticCurveTo(x, y + height, x, y + height - bl);
    ctx.lineTo(x, y + tl); ctx.quadraticCurveTo(x, y, x + tl, y);
    ctx.closePath();
  }

  function drawBird() {
    ctx.save();
    ctx.translate(BIRD_X, bird.y);
    ctx.rotate(bird.rotation);

    // Tail feathers.
    ctx.fillStyle = '#e9914b';
    ctx.strokeStyle = '#754e45';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12, 4); ctx.lineTo(-28, -2); ctx.lineTo(-24, 7); ctx.lineTo(-31, 12); ctx.lineTo(-11, 12); ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Wing sits behind the round body and flaps with the flying animation.
    const wingLift = state === 'playing' ? Math.sin(elapsed * 25) * 5 : Math.sin(elapsed * 4) * 3;
    ctx.fillStyle = '#e8914b';
    ctx.strokeStyle = '#754e45';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(-4, 3 + wingLift, 12, 7, -.24, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    const bodyGradient = ctx.createLinearGradient(-18, -18, 15, 19);
    bodyGradient.addColorStop(0, '#ffe08a');
    bodyGradient.addColorStop(.7, '#f9bd5d');
    bodyGradient.addColorStop(1, '#ee9b50');
    ctx.fillStyle = bodyGradient;
    ctx.strokeStyle = '#754e45';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 19, 16, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Cheek patch.
    ctx.fillStyle = 'rgba(236, 128, 91, .52)';
    ctx.beginPath(); ctx.ellipse(9, 7, 4.3, 2.8, 0, 0, Math.PI * 2); ctx.fill();

    // Beak.
    ctx.fillStyle = '#e97753';
    ctx.strokeStyle = '#754e45';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(14, -3); ctx.lineTo(26, 1); ctx.lineTo(14, 5); ctx.closePath(); ctx.fill(); ctx.stroke();

    // Oversized friendly eye.
    ctx.fillStyle = '#fffaf0';
    ctx.beginPath(); ctx.ellipse(9, -7, 7.2, 8.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#243a39';
    ctx.beginPath(); ctx.arc(11.3, -6.2, 3.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(12.2, -7.5, 1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawParticles() {
    for (const particle of particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawGround() {
    const ground = ctx.createLinearGradient(0, GROUND_Y, 0, HEIGHT);
    ground.addColorStop(0, '#f2c56f');
    ground.addColorStop(.14, '#e9b75d');
    ground.addColorStop(1, '#e3aa54');
    ctx.fillStyle = ground;
    ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);
    ctx.fillStyle = '#f5d487';
    ctx.fillRect(0, GROUND_Y, WIDTH, 9);
    ctx.fillStyle = '#b9a35f';
    ctx.fillRect(0, GROUND_Y + 9, WIDTH, 2);

    ctx.save();
    ctx.beginPath(); ctx.rect(0, GROUND_Y + 12, WIDTH, HEIGHT - GROUND_Y - 12); ctx.clip();
    ctx.strokeStyle = 'rgba(160, 116, 57, .22)';
    ctx.lineWidth = 2;
    for (let x = -48 + groundOffset; x < WIDTH + 48; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, GROUND_Y + 29); ctx.lineTo(x + 18, GROUND_Y + 29); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 24, GROUND_Y + 53); ctx.lineTo(x + 42, GROUND_Y + 53); ctx.stroke();
    }
    ctx.restore();
  }

  function tick(timestamp) {
    const dt = lastFrame ? Math.min((timestamp - lastFrame) / 1000, .033) : 0;
    lastFrame = timestamp;
    if (state !== 'paused') update(dt);
    draw();
    requestAnimationFrame(tick);
  }

  canvas.addEventListener('pointerdown', event => {
    event.preventDefault();
    if (state === 'ready') startGame();
    else if (state === 'playing') flap();
  });

  overlay.addEventListener('pointerdown', event => {
    if (event.target === overlay && state === 'ready') startGame();
  });

  playButton.addEventListener('click', () => {
    if (state === 'paused') pauseGame();
    else startGame();
  });

  pauseButton.addEventListener('click', pauseGame);
  soundButton.addEventListener('click', () => setSound(!soundEnabled));

  window.addEventListener('keydown', event => {
    if (event.repeat) return;
    const target = event.target;
    const isButton = target instanceof HTMLElement && target.closest('button');
    if (event.code === 'KeyM') {
      setSound(!soundEnabled);
      return;
    }
    if (event.code === 'KeyP' && !isButton) {
      if (state === 'playing' || state === 'paused') pauseGame();
      return;
    }
    if (event.code === 'Escape' && state === 'paused') {
      pauseGame();
      return;
    }
    if ((event.code === 'Space' || event.code === 'ArrowUp') && !isButton) {
      event.preventDefault();
      if (state === 'ready') startGame();
      else if (state === 'playing') flap();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing') pauseGame();
  });

  requestAnimationFrame(tick);
})();
