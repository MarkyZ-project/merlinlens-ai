// ===== DOM ELEMENTS =====
const video = document.getElementById('webcam');
const screenLoading = document.getElementById('screen-loading');
const screenCamera = document.getElementById('screen-camera');
const screenCrop = document.getElementById('screen-crop');
const screenResults = document.getElementById('screen-results');
const screenError = document.getElementById('screen-error');

const loadText = document.getElementById('loading-text');
const loadBar = document.getElementById('loading-bar');

const btnSwitch = document.getElementById('btn-switch');
const btnHistory = document.getElementById('btn-history');
const btnShutter = document.getElementById('btn-shutter');

const btnBackCrop = document.getElementById('btn-back-crop');
const btnScan = document.getElementById('btn-scan');
const cropCanvas = document.getElementById('crop-canvas');
const cropHint = document.getElementById('crop-hint');

const btnBackResults = document.getElementById('btn-back-results');
const btnNewScan = document.getElementById('btn-new-scan');
const resultThumb = document.getElementById('result-thumb');
const resEmoji = document.getElementById('res-emoji');
const resName = document.getElementById('res-name');
const resConf = document.getElementById('res-conf');
const resPreds = document.getElementById('res-preds');
const linkGrid = document.getElementById('link-grid');

const historyOverlay = document.getElementById('history-overlay');
const btnCloseHistory = document.getElementById('btn-close-history');
const historyList = document.getElementById('history-list');
const btnClearHistory = document.getElementById('btn-clear-history');
const btnRetry = document.getElementById('btn-retry');

// ===== STATE =====
let model = null;
let facingMode = 'environment';
let imageCapture = null;
let snapshotImage = null; // Image object holding the full photo
let history = JSON.parse(localStorage.getItem('merlinlens_history')) || [];

// Crop selection box
let cropBox = { x: 0, y: 0, w: 0, h: 0 };
let isDragging = false;
let startX, startY;
const ctxCrop = cropCanvas.getContext('2d');
const ctxThumb = resultThumb.getContext('2d');

// ===== EMOJIS & TRANSLATIONS =====
const emojiMap = {
  'loudspeaker': '🔊', 'speaker': '🔊', 'laptop': '💻', 'desktop': '🖥️',
  'keyboard': '⌨️', 'mouse': '🖱️', 'cellular': '📱', 'phone': '📱',
  'cup': '☕', 'mug': '☕', 'bottle': '🍶', 'sunglasses': '🕶️',
  'backpack': '🎒', 'wallet': '👛', 'shoe': '👟', 'dog': '🐕', 'cat': '🐈',
  'car': '🚗', 'bicycle': '🚲', 'book': '📖', 'watch': '⌚', 'television': '📺',
  'pizza': '🍕', 'banana': '🍌', 'chair': '🪑', 'camera': '📷', 'printer': '🖨️',
  'monitor': '🖥️', 'headphone': '🎧'
};

const translations = {
  'loudspeaker, speaker, speaker unit, speaker system, loudspeaker system': 'Cassa Audio',
  'notebook, notebook computer': 'Computer Portatile',
  'laptop, laptop computer': 'Computer Portatile',
  'desktop computer': 'Computer Fisso',
  'mouse, computer mouse': 'Mouse',
  'computer keyboard, keypad': 'Tastiera',
  'cellular telephone, cellular phone, cellphone, cell phone, mobile phone': 'Smartphone',
  'coffee mug': 'Tazza',
  'water bottle': 'Bottiglia d\'Acqua',
  'sunglasses, dark glasses, shades': 'Occhiali da Sole',
  'wallet, billfold, notecase, pocketbook': 'Portafoglio',
  'backpack, back pack, knapsack, packsack, rucksack, haversack': 'Zaino',
  'running shoe': 'Scarpa da Corsa',
  'digital watch': 'Orologio',
  'television, television set': 'Televisore',
  'remote control, remote': 'Telecomando',
  'pizza, pizza pie': 'Pizza',
  'chair': 'Sedia',
  'desk': 'Scrivania',
  'reflex camera': 'Fotocamera Reflex',
  'printer': 'Stampante',
  'monitor': 'Monitor',
};

function translate(label) {
  if (translations[label]) return translations[label];
  for (const [k, v] of Object.entries(translations)) {
    if (label.includes(k.split(',')[0])) return v;
  }
  return label.split(',')[0].replace(/^\w/, c => c.toUpperCase());
}

function getEmoji(label) {
  const low = label.toLowerCase();
  for (const k in emojiMap) {
    if (low.includes(k)) return emojiMap[k];
  }
  return '🔍';
}

// ===== UTILS =====
function setScreen(screen) {
  [screenLoading, screenCamera, screenCrop, screenResults, screenError].forEach(s => s.classList.add('hidden'));
  screen.classList.remove('hidden');
}

function setProgress(pct, text) {
  loadBar.style.width = pct + '%';
  loadText.textContent = text;
}

// ===== CAMERA =====
async function startCamera() {
  try {
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(t => t.stop());
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } }
    });
    video.srcObject = stream;
    video.style.transform = facingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)';
    await video.play();
    return true;
  } catch (err) {
    console.error(err);
    setScreen(screenError);
    return false;
  }
}

// ===== INIT =====
async function init() {
  try {
    setProgress(20, 'Inizializzazione AI...');
    await startCamera();
    setProgress(50, 'Scaricamento rete neurale...');
    model = await mobilenet.load({ version: 2, alpha: 1.0 });
    setProgress(100, 'Tutto pronto!');
    setTimeout(() => {
      screenLoading.classList.add('fade-out');
      setScreen(screenCamera);
    }, 400);
  } catch (e) {
    console.error(e);
    setProgress(0, 'Errore di caricamento.');
  }
}

// ===== SHUTTER & CROP =====
btnShutter.addEventListener('click', () => {
  // Take a snapshot from the video
  const c = document.createElement('canvas');
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  const cx = c.getContext('2d');
  if (facingMode === 'user') {
    cx.translate(c.width, 0);
    cx.scale(-1, 1);
  }
  cx.drawImage(video, 0, 0, c.width, c.height);
  
  snapshotImage = new Image();
  snapshotImage.onload = () => {
    setupCropScreen();
  };
  snapshotImage.src = c.toDataURL('image/jpeg');
  
  // Flash effect
  screenCamera.style.background = 'white';
  setTimeout(() => screenCamera.style.background = '#000', 100);
});

function setupCropScreen() {
  setScreen(screenCrop);
  
  // Calculate best fit
  const rect = cropCanvas.parentElement.getBoundingClientRect();
  const ratio = snapshotImage.width / snapshotImage.height;
  
  if (rect.width / rect.height > ratio) {
    cropCanvas.height = rect.height;
    cropCanvas.width = rect.height * ratio;
  } else {
    cropCanvas.width = rect.width;
    cropCanvas.height = rect.width / ratio;
  }
  
  // Initial box (center 50%)
  cropBox = {
    x: cropCanvas.width * 0.25,
    y: cropCanvas.height * 0.25,
    w: cropCanvas.width * 0.5,
    h: cropCanvas.height * 0.5
  };
  
  btnScan.disabled = false;
  drawCrop();
  cropHint.classList.remove('hidden-anim');
  setTimeout(() => cropHint.classList.add('hidden-anim'), 3000);
}

function drawCrop() {
  ctxCrop.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
  // Draw image
  ctxCrop.drawImage(snapshotImage, 0, 0, cropCanvas.width, cropCanvas.height);
  
  // Dim background
  ctxCrop.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctxCrop.fillRect(0, 0, cropCanvas.width, cropBox.y);
  ctxCrop.fillRect(0, cropBox.y, cropBox.x, cropBox.h);
  ctxCrop.fillRect(cropBox.x + cropBox.w, cropBox.y, cropCanvas.width - cropBox.x - cropBox.w, cropBox.h);
  ctxCrop.fillRect(0, cropBox.y + cropBox.h, cropCanvas.width, cropCanvas.height - cropBox.y - cropBox.h);
  
  // Draw selection borders
  ctxCrop.strokeStyle = '#c084fc';
  ctxCrop.lineWidth = 3;
  ctxCrop.strokeRect(cropBox.x, cropBox.y, cropBox.w, cropBox.h);
  
  // Corners
  const cl = 15;
  ctxCrop.fillStyle = '#fff';
  // TL
  ctxCrop.fillRect(cropBox.x - 3, cropBox.y - 3, cl, 6);
  ctxCrop.fillRect(cropBox.x - 3, cropBox.y - 3, 6, cl);
  // TR
  ctxCrop.fillRect(cropBox.x + cropBox.w - cl + 3, cropBox.y - 3, cl, 6);
  ctxCrop.fillRect(cropBox.x + cropBox.w - 3, cropBox.y - 3, 6, cl);
  // BL
  ctxCrop.fillRect(cropBox.x - 3, cropBox.y + cropBox.h - 3, cl, 6);
  ctxCrop.fillRect(cropBox.x - 3, cropBox.y + cropBox.h - cl + 3, 6, cl);
  // BR
  ctxCrop.fillRect(cropBox.x + cropBox.w - cl + 3, cropBox.y + cropBox.h - 3, cl, 6);
  ctxCrop.fillRect(cropBox.x + cropBox.w - 3, cropBox.y + cropBox.h - cl + 3, 6, cl);
}

// Touch/Mouse events for cropping
function getPos(e) {
  const rect = cropCanvas.getBoundingClientRect();
  const evt = e.touches ? e.touches[0] : e;
  return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
}

cropCanvas.addEventListener('mousedown', e => { isDragging = true; const p = getPos(e); startX = p.x; startY = p.y; });
cropCanvas.addEventListener('touchstart', e => { isDragging = true; const p = getPos(e); startX = p.x; startY = p.y; e.preventDefault(); }, {passive: false});

function moveBox(e) {
  if (!isDragging) return;
  const p = getPos(e);
  const dx = p.x - startX;
  const dy = p.y - startY;
  
  cropBox.x = Math.max(0, Math.min(cropBox.x + dx, cropCanvas.width - cropBox.w));
  cropBox.y = Math.max(0, Math.min(cropBox.y + dy, cropCanvas.height - cropBox.h));
  
  startX = p.x; startY = p.y;
  drawCrop();
}
cropCanvas.addEventListener('mousemove', moveBox);
cropCanvas.addEventListener('touchmove', e => { moveBox(e); e.preventDefault(); }, {passive: false});

function stopDrag() { isDragging = false; }
window.addEventListener('mouseup', stopDrag);
window.addEventListener('touchend', stopDrag);

// ===== SCANNING =====
btnScan.addEventListener('click', async () => {
  if (!model) return;
  btnScan.innerHTML = '<div class="rs" style="width:18px;height:18px;border-width:2px;position:relative;border-top-color:#fff;animation:spin 1s linear infinite"></div> Analisi...';
  
  // Extract crop
  const scaleX = snapshotImage.width / cropCanvas.width;
  const scaleY = snapshotImage.height / cropCanvas.height;
  
  const extractCanvas = document.createElement('canvas');
  extractCanvas.width = cropBox.w * scaleX;
  extractCanvas.height = cropBox.h * scaleY;
  const exCtx = extractCanvas.getContext('2d');
  
  exCtx.drawImage(
    snapshotImage,
    cropBox.x * scaleX, cropBox.y * scaleY, cropBox.w * scaleX, cropBox.h * scaleY,
    0, 0, extractCanvas.width, extractCanvas.height
  );
  
  const imgDataUrl = extractCanvas.toDataURL('image/jpeg');
  const imgEl = new Image();
  imgEl.onload = async () => {
    try {
      const preds = await model.classify(imgEl, 3);
      showResults(preds, imgDataUrl);
    } catch(err) {
      console.error(err);
      btnScan.innerHTML = 'Errore, riprova';
    }
  };
  imgEl.src = imgDataUrl;
});

function showResults(preds, thumbUrl) {
  btnScan.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Scansiona';
  
  setScreen(screenResults);
  
  // Thumb
  const img = new Image();
  img.onload = () => {
    resultThumb.width = img.width;
    resultThumb.height = img.height;
    ctxThumb.drawImage(img, 0, 0);
  };
  img.src = thumbUrl;
  
  const top = preds[0];
  const name = translate(top.className);
  const conf = Math.round(top.probability * 100);
  const emoji = getEmoji(top.className);
  
  resName.textContent = name;
  resConf.textContent = `Sicurezza: ${conf}%`;
  resEmoji.textContent = emoji;
  
  // Pred bars
  resPreds.innerHTML = preds.map(p => {
    const pt = Math.round(p.probability * 100);
    return `<div class="pred-row">
      <span class="pred-label">${translate(p.className)}</span>
      <div class="pred-bar-track"><div class="pred-bar-fill" style="width:${pt}%"></div></div>
      <span class="pred-pct">${pt}%</span>
    </div>`;
  }).join('');
  
  // Generate links
  const query = encodeURIComponent(name);
  linkGrid.innerHTML = `
    <a href="https://www.google.com/search?q=${query}" target="_blank" class="link-card">
      <img src="https://www.google.com/favicon.ico" alt="G"> Cerca su Google
    </a>
    <a href="https://www.google.com/search?tbm=isch&q=${query}" target="_blank" class="link-card">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Immagini
    </a>
    <a href="https://www.amazon.it/s?k=${query}" target="_blank" class="link-card">
      <img src="https://www.amazon.it/favicon.ico" alt="A"> Compra su Amazon
    </a>
    <a href="https://it.wikipedia.org/wiki/Speciale:Ricerca?search=${query}" target="_blank" class="link-card">
      <img src="https://it.wikipedia.org/favicon.ico" alt="W"> Wikipedia
    </a>
  `;
  
  // Save to history
  const entry = {
    id: Date.now(),
    name, emoji, thumb: thumbUrl, date: new Date().toLocaleString('it-IT')
  };
  history.unshift(entry);
  if(history.length > 20) history.pop();
  localStorage.setItem('merlinlens_history', JSON.stringify(history));
  renderHistory();
}

// ===== HISTORY =====
function renderHistory() {
  if (history.length === 0) {
    historyList.innerHTML = '<p class="history-empty">Nessuna scansione ancora</p>';
    btnClearHistory.classList.add('hidden');
    return;
  }
  btnClearHistory.classList.remove('hidden');
  historyList.innerHTML = history.map(h => `
    <div class="history-item">
      <img src="${h.thumb}" style="width:48px;height:48px;border-radius:8px;object-fit:cover">
      <div class="history-item-info">
        <h4>${h.emoji} ${h.name}</h4>
        <p>${h.date}</p>
      </div>
    </div>
  `).join('');
}

btnHistory.addEventListener('click', () => {
  renderHistory();
  historyOverlay.classList.remove('hidden');
});
btnCloseHistory.addEventListener('click', () => historyOverlay.classList.add('hidden'));
btnClearHistory.addEventListener('click', () => {
  if(confirm('Cancellare tutta la cronologia?')) {
    history = [];
    localStorage.removeItem('merlinlens_history');
    renderHistory();
  }
});

// ===== BUTTONS =====
btnSwitch.addEventListener('click', async () => {
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  await startCamera();
});

btnBackCrop.addEventListener('click', () => setScreen(screenCamera));
btnBackResults.addEventListener('click', () => setScreen(screenCrop));
btnNewScan.addEventListener('click', () => setScreen(screenCamera));
btnRetry.addEventListener('click', startCamera);

// BOOT
init();
