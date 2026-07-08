import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';

const video = document.getElementById('webcam');
const statusIndicator = document.getElementById('status-indicator');
const predictionContainer = document.getElementById('prediction-container');
const predictionText = document.getElementById('prediction-text');
const confidenceBar = document.getElementById('confidence-bar');
const confidenceText = document.getElementById('confidence-text');
const switchCameraBtn = document.getElementById('switch-camera-btn');

let model = null;
let currentFacingMode = 'environment'; // 'environment' for back camera, 'user' for front

// Dizionario semplice per traduzioni comuni
const dictionary = {
  'loudspeaker': 'Cassa Audio',
  'notebook, notebook computer': 'Computer Portatile',
  'laptop, laptop computer': 'Computer Portatile',
  'desktop computer': 'Computer Fisso',
  'mouse, computer mouse': 'Mouse',
  'keyboard, computer keyboard': 'Tastiera',
  'cellular telephone, cellular phone, cellphone, cell, mobile phone': 'Smartphone',
  'iPod': 'Lettore MP3',
  'coffee mug': 'Tazza',
  'cup': 'Bicchiere/Tazza',
  'water bottle': 'Bottiglia d\'acqua',
  'sunglasses, dark glasses, shades': 'Occhiali da sole',
  'wallet, billfold, notecase, pocketbook': 'Portafoglio',
  'backpack, back pack, knapsack, packsack, rucksack, haversack': 'Zaino'
};

function translateLabel(label) {
  // Check if there is a direct match in our dictionary
  if (dictionary[label]) {
    return dictionary[label];
  }
  // Otherwise, take the first word/phrase before a comma for simplicity
  return label.split(',')[0];
}

async function setupCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Browser API navigator.mediaDevices.getUserMedia not available');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: currentFacingMode
    }
  });
  
  video.srcObject = stream;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      resolve(video);
    };
  });
}

async function switchCamera() {
  currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
  
  // Mirror video if using front camera
  if (currentFacingMode === 'user') {
    video.style.transform = 'scaleX(-1)';
  } else {
    video.style.transform = 'scaleX(1)';
  }

  // Stop current tracks
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
  }

  await setupCamera();
}

async function loadModel() {
  try {
    model = await mobilenet.load({
      version: 2,
      alpha: 1.0
    });
    
    // Hide status, show prediction container
    statusIndicator.classList.add('hidden');
    predictionContainer.classList.remove('hidden');
    
    // Start predicting
    predictFrame();
  } catch (error) {
    console.error('Error loading model:', error);
    statusIndicator.querySelector('span').textContent = 'Errore caricamento IA';
  }
}

async function predictFrame() {
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    // Classify the image
    const predictions = await model.classify(video);
    
    if (predictions && predictions.length > 0) {
      const topPrediction = predictions[0];
      
      // Update UI
      const translatedName = translateLabel(topPrediction.className);
      predictionText.textContent = translatedName;
      
      const confidencePercent = Math.round(topPrediction.probability * 100);
      confidenceBar.style.width = `${confidencePercent}%`;
      confidenceText.textContent = `${confidencePercent}%`;
    }
  }
  
  // Loop
  requestAnimationFrame(predictFrame);
}

// Event Listeners
switchCameraBtn.addEventListener('click', switchCamera);

// Initialize app
async function init() {
  try {
    await setupCamera();
    video.play();
    await loadModel();
  } catch (error) {
    console.error('Initialization error:', error);
    statusIndicator.querySelector('span').textContent = 'Impossibile accedere alla fotocamera';
  }
}

init();
