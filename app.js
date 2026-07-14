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

let model = null;
let facingMode = 'environment';

// ===== EMOJI MAP =====
const emojiMap = {
  'loudspeaker': '🔊', 'speaker': '🔊',
  'laptop': '💻', 'notebook': '💻', 'desktop': '🖥️', 'monitor': '🖥️',
  'keyboard': '⌨️', 'mouse': '🖱️', 'remote': '📱',
  'cellular': '📱', 'phone': '📱', 'iPod': '🎵',
  'cup': '☕', 'mug': '☕', 'bottle': '🍶', 'wine': '🍷',
  'sunglasses': '🕶️', 'backpack': '🎒', 'wallet': '👛', 'handbag': '👜',
  'shoe': '👟', 'dog': '🐕', 'cat': '🐈', 'bird': '🐦',
  'car': '🚗', 'truck': '🚚', 'bicycle': '🚲',
  'book': '📖', 'pen': '🖊️', 'clock': '🕐', 'watch': '⌚',
  'television': '📺', 'tv': '📺', 'guitar': '🎸', 'piano': '🎹',
  'pizza': '🍕', 'banana': '🍌', 'apple': '🍎', 'orange': '🍊',
  'chair': '🪑', 'couch': '🛋️', 'table': '🪑', 'bed': '🛏️',
  'umbrella': '☂️', 'camera': '📷', 'printer': '🖨️', 'headphone': '🎧',
};

// ===== ITALIAN TRANSLATIONS =====
const translations = {
  'loudspeaker, speaker, speaker unit, speaker system, loudspeaker system': 'Cassa Audio / Altoparlante',
  'notebook, notebook computer': 'Computer Portatile',
  'laptop, laptop computer': 'Computer Portatile',
  'desktop computer': 'Computer Fisso',
  'mouse, computer mouse': 'Mouse',
  'computer keyboard, keypad': 'Tastiera',
  'cellular telephone, cellular phone, cellphone, cell phone, mobile phone': 'Smartphone',
  'iPod': 'Lettore Musicale',
  'coffee mug': 'Tazza da Caffè',
  'cup': 'Tazza',
  'water bottle': 'Bottiglia d\'Acqua',
  'wine bottle': 'Bottiglia di Vino',
  'sunglasses, dark glasses, shades': 'Occhiali da Sole',
  'wallet, billfold, notecase, pocketbook': 'Portafoglio',
  'backpack, back pack, knapsack, packsack, rucksack, haversack': 'Zaino',
  'running shoe': 'Scarpa da Corsa',
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
  'reflex camera': 'Fotocamera Reflex',
  'printer': 'Stampante',
  'sports car, sport car': 'Auto Sportiva',
  'mountain bike, all-terrain bike': 'Mountain Bike',
  'motor scooter, scooter': 'Scooter',
  'golden retriever': 'Golden Retriever',
  'German shepherd, German shepherd dog, German police dog, alsatian': 'Pastore Tedesco',
  'Labrador retriever': 'Labrador',
  'tabby, tabby cat': 'Gatto Soriano',
  'jean, blue jean, denim': 'Jeans',
  'T-shirt': 'Maglietta',
  'monitor': 'Monitor',
};

function translate(label) {
  if (translations[label]) return translations[label];
  for (const [key, val] of Object.entries(translations)) {
    if (label.includes(key.split(',')[0])) return val;
  }
  return label.split(',')[0].replace(/^\w/, function(c) { return c.toUpperCase(); });
}

function getEmoji(label) {
  var lower = label.toLowerCase();
  for (var key in emojiMap) {
    if (lower.includes(key)) return emojiMap[key];
  }
  return '🔍';
}

// ===== CAMERA =====
async function startCamera() {
  try {
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(function(t) { t.stop(); });
    }
    var stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    video.srcObject = stream;
    video.style.transform = facingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)';
    await video.play();
    errorOvl.classList.add('hidden');
    return true;
  } catch (err) {
    console.error('Camera error:', err);
    errorOvl.classList.remove('hidden');
    document.getElementById('error-text').textContent =
      err.name === 'NotAllowedError'
        ? 'Consenti l\'accesso alla fotocamera nelle impostazioni del browser.'
        : 'Fotocamera non trovata. Verifica che il dispositivo abbia una fotocamera.';
    return false;
  }
}

// ===== LOAD & RUN =====
async function init() {
  try {
    setProgress(10, 'Inizializzazione TensorFlow...');
    console.log('[MerlinLens] TF.js version:', tf.version.tfjs);

    setProgress(30, 'Avvio fotocamera...');
    await startCamera();

    setProgress(50, 'Scaricamento modello MobileNet...');
    console.log('[MerlinLens] Loading MobileNet...');
    model = await mobilenet.load({ version: 2, alpha: 1.0 });
    console.log('[MerlinLens] Model loaded!');

    setProgress(100, 'Pronto!');

    setTimeout(function() {
      loadScreen.classList.add('fade-out');
      resultPanel.classList.add('visible');
      classifyLoop();
    }, 500);

  } catch (err) {
    console.error('[MerlinLens] Init failed:', err);
    setProgress(0, 'Errore: ' + err.message);
  }
}

function setProgress(pct, text) {
  loadBar.style.width = pct + '%';
  loadText.textContent = text;
}

async function classifyLoop() {
  if (!model) return;

  if (video.readyState >= video.HAVE_ENOUGH_DATA) {
    try {
      var predictions = await model.classify(video, 3);
      if (predictions && predictions.length > 0) {
        updateUI(predictions);
      }
    } catch (e) {
      console.error('Classify error:', e);
    }
  }

  setTimeout(function() { requestAnimationFrame(classifyLoop); }, 200);
}

function updateUI(predictions) {
  var top = predictions[0];
  var confidence = Math.round(top.probability * 100);
  var name = translate(top.className);

  resultName.textContent = name;
  resultConf.textContent = 'Sicurezza: ' + confidence + '%';
  resultIcon.textContent = getEmoji(top.className);

  scanOverlay.classList.toggle('detected', confidence > 60);

  predsList.innerHTML = predictions.map(function(p) {
    var pct = Math.round(p.probability * 100);
    var label = translate(p.className);
    return '<div class="pred-row">' +
      '<span class="pred-label">' + label + '</span>' +
      '<div class="pred-bar-track"><div class="pred-bar-fill" style="width:' + pct + '%"></div></div>' +
      '<span class="pred-pct">' + pct + '%</span>' +
    '</div>';
  }).join('');
}

// ===== EVENTS =====
btnSwitch.addEventListener('click', function() {
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  startCamera();
});

btnRetry.addEventListener('click', function() { startCamera(); });

// ===== GO =====
init();
