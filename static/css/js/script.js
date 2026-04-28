/**
 * Churn Prediction Dashboard
 * Theme, model selection, form submission, supervised/unsupervised display
 */

// ============================================
// Theme Management
// ============================================
const ThemeManager = (() => {
  const STORAGE_KEY = 'theme';
  const DARK_MODE_CLASS = 'dark-mode';
  let themeToggle, iconSun, iconMoon, body;

  const init = () => {
    themeToggle = document.getElementById('themeToggle');
    iconSun = document.getElementById('themeIconSun');
    iconMoon = document.getElementById('themeIconMoon');
    body = document.body;
    if (!themeToggle) return;
    applyTheme(localStorage.getItem(STORAGE_KEY) || 'light');
    themeToggle.addEventListener('click', () => {
      applyTheme(body.classList.contains(DARK_MODE_CLASS) ? 'light' : 'dark');
    });
  };

  const applyTheme = (theme) => {
    body.classList.toggle(DARK_MODE_CLASS, theme === 'dark');
    if (iconSun && iconMoon) {
      iconSun.classList.toggle('hidden', theme !== 'dark');
      iconMoon.classList.toggle('hidden', theme === 'dark');
    }
    localStorage.setItem(STORAGE_KEY, theme);
  };

  return { init, applyTheme };
})();

// ============================================
// Model Selector
// ============================================
const ModelSelector = (() => {
  const STORAGE_KEY = 'selectedModel';
  let selectedModel = 'random_forest';
  let highlight, buttons = [];

  const MODEL_LABELS = {
    random_forest: 'Random Forest',
    xgboost: 'XGBoost',
    gmm: 'GMM',
    dbscan: 'DBSCAN'
  };

  const SUPERVISED = ['random_forest', 'xgboost'];

  const init = () => {
    highlight = document.getElementById('modelHighlight');
    buttons = Array.from(document.querySelectorAll('.model-option'));
    if (!buttons.length) return;

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && MODEL_LABELS[saved]) {
      selectedModel = saved;
      buttons.forEach(btn => btn.classList.remove('active'));
      const target = buttons.find(btn => btn.dataset.model === saved);
      if (target) target.classList.add('active');
    }

    buttons.forEach(btn => btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedModel = btn.dataset.model;
      localStorage.setItem(STORAGE_KEY, selectedModel);
      moveHighlight();
    }));

    requestAnimationFrame(() => moveHighlight());
  };

  const moveHighlight = () => {
    if (!highlight) return;
    const active = document.querySelector('.model-option.active');
    if (!active) return;
    const parentRect = active.parentElement.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    highlight.style.width = activeRect.width + 'px';
    highlight.style.transform = 'translateX(' + (activeRect.left - parentRect.left - 4) + 'px)';
  };

  const getSelected = () => selectedModel;
  const getLabel = () => MODEL_LABELS[selectedModel] || selectedModel;
  const isSupervised = () => SUPERVISED.includes(selectedModel);

  return { init, getSelected, getLabel, isSupervised };
})();

// ============================================
// Form Handler
// ============================================
const FormHandler = (() => {
  const FIELD_IDS = [
    'tenure', 'MonthlyCharges', 'Contract', 'InternetService',
    'OnlineSecurity', 'TechSupport', 'StreamingTV', 'StreamingMovies',
    'MultipleLines', 'PaymentMethod', 'PaperlessBilling', 'SeniorCitizen'
  ];

  let form, resultsSection, predictionForm;

  const init = () => {
    form = document.getElementById('churnForm');
    resultsSection = document.getElementById('resultsSection');
    predictionForm = document.getElementById('predictionForm');
    if (!form) return;
    form.addEventListener('submit', handleSubmit);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.querySelector('span').textContent = 'Predicting...';
    }

    const formData = { model: ModelSelector.getSelected() };
    FIELD_IDS.forEach(id => {
      formData[id] = document.getElementById(id).value;
    });

    try {
      const response = await fetch('/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();

      if (data.success) {
        displayResults(data);
      } else {
        alert('Error: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Prediction error:', error);
      alert('Prediction failed. Please try again.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.querySelector('span').textContent = 'Get Prediction';
      }
    }
  };

  const displayResults = (data) => {
    if (predictionForm) predictionForm.style.display = 'none';
    if (resultsSection) resultsSection.classList.remove('hidden');

    const supDiv = document.getElementById('supervisedResult');
    const unsupDiv = document.getElementById('unsupervisedResult');
    const badge = document.getElementById('resultTypeBadge');

    if (data.model_type === 'supervised') {
      supDiv.classList.remove('hidden');
      unsupDiv.classList.add('hidden');
      badge.textContent = 'Supervised';
      badge.className = 'result-type-badge badge-supervised';
      showSupervisedResult(data);
    } else {
      supDiv.classList.add('hidden');
      unsupDiv.classList.remove('hidden');
      badge.textContent = 'Unsupervised';
      badge.className = 'result-type-badge badge-unsupervised';
      showUnsupervisedResult(data);
    }

    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const showSupervisedResult = (data) => {
    const resultCard = document.getElementById('resultCard');
    const predictionResult = document.getElementById('predictionResult');
    const confidenceScore = document.getElementById('confidenceScore');
    const confidenceBar = document.getElementById('confidenceBar');
    const modelName = document.getElementById('resultModelName');

    resultCard.classList.remove('result-success', 'result-danger');

    if (data.prediction === 'Churn') {
      resultCard.classList.add('result-danger');
      predictionResult.textContent = 'Churn Likely';
    } else {
      resultCard.classList.add('result-success');
      predictionResult.textContent = 'No Churn';
    }

    confidenceScore.textContent = data.confidence;
    confidenceBar.style.width = '0%';
    requestAnimationFrame(() => {
      confidenceBar.style.width = (data.probability * 100) + '%';
    });
    modelName.textContent = ModelSelector.getLabel();
  };

  const showUnsupervisedResult = (data) => {
    const clusterCard = document.getElementById('clusterCard');
    const clusterName = document.getElementById('clusterName');
    const clusterDesc = document.getElementById('clusterDescription');
    const modelName = document.getElementById('resultModelNameUnsup');

    clusterCard.classList.remove('result-success', 'result-danger', 'result-warning');
    clusterCard.classList.add('result-cluster');

    clusterName.textContent = data.cluster_label;
    clusterDesc.textContent = data.description || '';

    document.getElementById('profileTenure').textContent = data.profile.avg_tenure + ' mo';
    document.getElementById('profileCharges').textContent = '$' + data.profile.avg_monthly;
    document.getElementById('profileContract').textContent = data.profile.top_contract;
    document.getElementById('profileSize').textContent = data.profile.size;

    modelName.textContent = ModelSelector.getLabel();
  };

  const resetForm = () => {
    if (form) form.reset();
    if (predictionForm) predictionForm.style.display = 'block';
    if (resultsSection) resultsSection.classList.add('hidden');
    document.getElementById('supervisedResult').classList.add('hidden');
    document.getElementById('unsupervisedResult').classList.add('hidden');
  };

  return { init, resetForm };
})();

// ============================================
// Init
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
  ModelSelector.init();
  FormHandler.init();
  window.resetForm = FormHandler.resetForm;
  window.addEventListener('resize', () => ModelSelector.init());
});
