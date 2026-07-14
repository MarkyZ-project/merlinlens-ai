import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';

// ===== DOM =====
const video       = document.getElementById('webcam');
const loadScreen  = document.getElementById('loading-screen');
const loadText    = document.getElementById('loading-text');
const loadBar     = document.getElementById('loading-bar');
const resultPanel = document.getElementById('result-panel');
const predsList   = document.getElementById('predictions-list');
const resultName  = document.getElementById('result-name');
const resultConf  = document.getElementById('result-confidence');
const resultIcon  = document.getElementById('result-icon');
const scanOverlay = document.getElementById('scan-overlay');
const btnSwitch   = document.getElementById('btn-switch');
const btnRetry    = document.getElementById('btn-retry');
const errorOvl    = document.getElementById('error-overlay');

// ===== STATE =====
let model = null;
let facingMode = 'environment';
let isClassifying = false;

// ===== EMOJI MAP =====
const emojiMap = {
  'loudspeaker': '🔊', 'speaker': '🔊',
  'laptop': '💻', 'notebook': '💻', 'desktop': '🖥️', 'monitor': '🖥️',
  'keyboard': '⌨️', 'mouse': '🖱️', 'remote': '📱',
  'cellular': '📱', 'phone': '📱', 'iPod': '🎵',
  'cup': '☕', 'mug': '☕', 'bottle': '🍶', 'wine': '🍷', 'beer': '🍺',
  'sunglasses': '🕶️', 'sunglass': '🕶️',
  'backpack': '🎒', 'wallet': '👛', 'purse': '👜', 'handbag': '👜',
  'shoe': '👟', 'sandal': '👡', 'boot': '🥾',
  'dog': '🐕', 'cat': '🐈', 'bird': '🐦', 'fish': '🐟',
  'car': '🚗', 'truck': '🚚', 'bicycle': '🚲', 'motorcycle': '🏍️',
  'book': '📖', 'pen': '🖊️', 'pencil': '✏️', 'scissors': '✂️',
  'clock': '🕐', 'watch': '⌚', 'lamp': '💡', 'candle': '🕯️',
  'television': '📺', 'tv': '📺', 'screen': '📺',
  'guitar': '🎸', 'piano': '🎹', 'drum': '🥁',
  'pizza': '🍕', 'banana': '🍌', 'apple': '🍎', 'orange': '🍊',
  'chair': '🪑', 'couch': '🛋️', 'table': '🪑', 'bed': '🛏️',
  'umbrella': '☂️', 'pillow': '🛏️', 'towel': '🛁',
  'camera': '📷', 'printer': '🖨️', 'headphone': '🎧',
  'person': '👤', 'face': '😊',
  'default': '🔍'
};

// ===== ITALIAN TRANSLATIONS =====
const translations = {
  'loudspeaker, speaker, speaker unit, speaker system, loudspeaker system': 'Cassa Audio / Altoparlante',
  'notebook, notebook computer': 'Computer Portatile',
  'laptop, laptop computer': 'Computer Portatile',
  'desktop computer': 'Computer Fisso',
  'monitor': 'Monitor',
  'mouse, computer mouse': 'Mouse',
  'computer keyboard, keypad': 'Tastiera',
  'cellular telephone, cellular phone, cellphone, cell phone, mobile phone': 'Smartphone',
  'iPod': 'Lettore Musicale',
  'coffee mug': 'Tazza da Caffè',
  'cup': 'Tazza',
  'water bottle': 'Bottiglia d\'Acqua',
  'wine bottle': 'Bottiglia di Vino',
  'beer glass': 'Bicchiere da Birra',
  'sunglasses, dark glasses, shades': 'Occhiali da Sole',
  'wallet, billfold, notecase, pocketbook': 'Portafoglio',
  'backpack, back pack, knapsack, packsack, rucksack, haversack': 'Zaino',
  'running shoe': 'Scarpa da Corsa',
  'sandal': 'Sandalo',
  'digital watch': 'Orologio Digitale',
  'analog clock': 'Orologio Analogico',
  'television, television set': 'Televisore',
  'remote control, remote': 'Telecomando',
  'electric guitar': 'Chitarra Elettrica',
  'acoustic guitar': 'Chitarra Acustica',
  'grand piano, piano': 'Pianoforte',
  'pizza, pizza pie': 'Pizza',
  'banana': 'Banana',
  'orange': 'Arancia',
  'Granny Smith': 'Mela Verde',
  'chair': 'Sedia',
  'couch, sofa': 'Divano',
  'dining table': 'Tavolo',
  'desk': 'Scrivania',
  'bookcase': 'Libreria',
  'table lamp': 'Lampada da Tavolo',
  'umbrella': 'Ombrello',
  'pillow': 'Cuscino',
  'bath towel': 'Asciugamano',
  'reflex camera': 'Fotocamera Reflex',
  'Polaroid camera, Polaroid Land camera': 'Fotocamera Polaroid',
  'printer': 'Stampante',
  'headphone, earphone': 'Cuffie',
  'sports car, sport car': 'Auto Sportiva',
  'minivan': 'Monovolume',
  'pickup, pickup truck': 'Pick-up',
  'mountain bike, all-terrain bike': 'Mountain Bike',
  'bicycle-built-for-two, tandem bicycle, tandem': 'Bicicletta',
  'motor scooter, scooter': 'Scooter',
  'golden retriever': 'Golden Retriever',
  'German shepherd, German shepherd dog, German police dog, alsatian': 'Pastore Tedesco',
  'Labrador retriever': 'Labrador',
  'tabby, tabby cat': 'Gatto Soriano',
  'Persian cat': 'Gatto Persiano',
  'Egyptian cat': 'Gatto',
  'jean, blue jean, denim': 'Jeans',
  'T-shirt': 'Maglietta',
  'suit, suit of clothes': 'Completo',
  'bow tie, bow-tie, bowtie': 'Papillon',
  'sombrero': 'Sombrero',
  'cowboy hat, ten-gallon hat': 'Cappello da Cowboy',
};

function translate(label) {
  if (translations[label]) return translations[label];
  // Partial match
  for (const [key, val] of Object.entries(translations)) {
    if (label.includes(key.split(',')[0])) return val;
  }
  // Capitalize first word
  return label.split(',')[0].replace(/^\w/, c => c.toUpperCase());
}

function getEmoji(label) {
  const lower = label.toLowerCase();
  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (lower.includes(key)) return emoji;
  }
  return emojiMap.default;
}

// ===== CAMERA =====
async function startCamera() {
  try {
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(t => t.stop());
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    video.srcObject = stream;
    video.style.transform = facingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)';
    await video.play();
    errorOvl.classList.add('hidden');
  } catch (err) {
    console.error('Camera error:', err);
    errorOvl.classList.remove('hidden');
    document.getElementById('error-text').textContent =
      err.name === 'NotAllowedError'
        ? 'Consenti l\'accesso alla fotocamera nelle impostazioni del browser.'
        : 'Fotocamera non trovata. Verifica che il dispositivo abbia una fotocamera.';
  }
}

// ===== MODEL =====
async function loadModel() {
  setLoadProgress(20, 'Inizializzazione TensorFlow.js...');
  await tf.ready();

  setLoadProgress(50, 'Scaricamento modello MobileNet...');
  model = await mobilenet.load({ version: 2, alpha: 1.0 });

  setLoadProgress(80, 'Avvio fotocamera...');
  await startCamera();

  setLoadProgress(100, 'Pronto!');
  setTimeout(() => {
    loadScreen.classList.add('fade-out');
    resultPanel.classList.add('visible');
    startClassifying();
  }, 400);
}

function setLoadProgress(pct, text) {
  loadBar.style.width = pct + '%';
  loadText.textContent = text;
}

// ===== CLASSIFICATION LOOP =====
function startClassifying() {
  isClassifying = true;
  classifyLoop();
}

async function classifyLoop() {
  if (!isClassifying || !model) return;

  if (video.readyState >= video.HAVE_ENOUGH_DATA) {
    try {
      const predictions = await model.classify(video, 3);
      updateUI(predictions);
    } catch (e) {
      console.error('Classification error:', e);
    }
  }

  // ~5 FPS for smooth UX without burning CPU
  setTimeout(() => requestAnimationFrame(classifyLoop), 200);
}

function updateUI(predictions) {
  if (!predictions || predictions.length === 0) return;

  const top = predictions[0];
  const confidence = Math.round(top.probability * 100);
  const name = translate(top.className);
  const emoji = getEmoji(top.className);

  // Main result
  resultName.textContent = name;
  resultConf.textContent = `Sicurezza: ${confidence}%`;
  resultIcon.textContent = emoji;

  // Green corners when high confidence
  if (confidence > 60) {
    scanOverlay.classList.add('detected');
  } else {
    scanOverlay.classList.remove('detected');
  }

  // Top 3 mini-bars
  predsList.innerHTML = predictions.map(p => {
    const pct = Math.round(p.probability * 100);
    const label = translate(p.className);
    return `
      <div class="pred-row">
        <span class="pred-label">${label}</span>
        <div class="pred-bar-track"><div class="pred-bar-fill" style="width:${pct}%"></div></div>
        <span class="pred-pct">${pct}%</span>
      </div>`;
  }).join('');
}

// ===== EVENTS =====
btnSwitch.addEventListener('click', () => {
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  startCamera();
});

btnRetry.addEventListener('click', () => startCamera());

// ===== INIT =====
loadModel().catch(err => {
  console.error('Fatal init error:', err);
  loadText.textContent = 'Errore di caricamento. Ricarica la pagina.';
});
