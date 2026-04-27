/**
 * Churn Prediction Dashboard - Main JavaScript Module
 * Handles theme management, model selection, form submission, and prediction display
 * Last Updated: 2026
 */

// ============================================
// Theme Management Module
// ============================================

const ThemeManager = (() => {
  const STORAGE_KEY = 'theme';
  const DARK_MODE_CLASS = 'dark-mode';
  const THEME_LIGHT = 'light';
  const THEME_DARK = 'dark';

  let themeToggle = null;
  let iconSun = null;
  let iconMoon = null;
  let body = null;

  const init = () => {
    themeToggle = document.getElementById('themeToggle');
    iconSun = document.getElementById('themeIconSun');
    iconMoon = document.getElementById('themeIconMoon');
    body = document.body;

    if (!themeToggle) return;

    const savedTheme = localStorage.getItem(STORAGE_KEY) || THEME_LIGHT;
    applyTheme(savedTheme);
    themeToggle.addEventListener('click', toggleTheme);
  };

  const applyTheme = (theme) => {
    if (theme === THEME_DARK) {
      body.classList.add(DARK_MODE_CLASS);
      updateUI(true);
    } else {
      body.classList.remove(DARK_MODE_CLASS);
      updateUI(false);
    }
    localStorage.setItem(STORAGE_KEY, theme);
  };

  const toggleTheme = () => {
    const isDarkMode = body.classList.contains(DARK_MODE_CLASS);
    applyTheme(isDarkMode ? THEME_LIGHT : THEME_DARK);
  };

  const updateUI = (isDark) => {
    if (iconSun && iconMoon) {
      if (isDark) {
        iconSun.classList.remove('hidden');
        iconMoon.classList.add('hidden');
      } else {
        iconSun.classList.add('hidden');
        iconMoon.classList.remove('hidden');
      }
    }
  };

  const getCurrentTheme = () => {
    return body.classList.contains(DARK_MODE_CLASS) ? THEME_DARK : THEME_LIGHT;
  };

  return { init, toggleTheme, getCurrentTheme, applyTheme };
})();

// ============================================
// Model Selector Module
// ============================================

const ModelSelector = (() => {
  const STORAGE_KEY = 'selectedModel';
  let selectedModel = 'random_forest';
  let highlight = null;
  let buttons = [];

  const MODEL_LABELS = {
    random_forest: 'Random Forest',
    xgboost: 'XGBoost',
    gmm: 'GMM',
    dbscan: 'DBSCAN'
  };

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

    buttons.forEach(btn => {
      btn.addEventListener('click', () => selectModel(btn));
    });

    // Position highlight on first active button after render
    requestAnimationFrame(() => moveHighlight());
  };

  const selectModel = (btn) => {
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedModel = btn.dataset.model;
    localStorage.setItem(STORAGE_KEY, selectedModel);
    moveHighlight();
  };

  const moveHighlight = () => {
    if (!highlight) return;
    const active = document.querySelector('.model-option.active');
    if (!active) return;

    const parent = active.parentElement;
    const parentRect = parent.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();

    highlight.style.width = activeRect.width + 'px';
    highlight.style.transform = 'translateX(' + (activeRect.left - parentRect.left - 4) + 'px)';
  };

  const getSelected = () => selectedModel;
  const getLabel = () => MODEL_LABELS[selectedModel] || selectedModel;

  return { init, getSelected, getLabel };
})();

// ============================================
// Form Handler Module
// ============================================

const FormHandler = (() => {
  let form = null;
  let resultsSection = null;
  let predictionForm = null;
  let resultCard = null;
  let predictionResult = null;
  let confidenceScore = null;
  let confidenceBar = null;
  let resultModelName = null;

  const init = () => {
    form = document.getElementById('churnForm');
    resultsSection = document.getElementById('resultsSection');
    predictionForm = document.getElementById('predictionForm');
    resultCard = document.getElementById('resultCard');
    predictionResult = document.getElementById('predictionResult');
    confidenceScore = document.getElementById('confidenceScore');
    confidenceBar = document.getElementById('confidenceBar');
    resultModelName = document.getElementById('resultModelName');

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

    const formData = {
      tenure: document.getElementById('tenure').value,
      MonthlyCharges: document.getElementById('MonthlyCharges').value,
      Contract: document.getElementById('Contract').value,
      InternetService: document.getElementById('InternetService').value,
      model: ModelSelector.getSelected()
    };

    try {
      const response = await fetch('/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        displayResults(data.prediction, data.confidence, data.probability);
      } else {
        showError('Error: ' + (data.error || 'Unknown error occurred'));
      }
    } catch (error) {
      console.error('Prediction error:', error);
      showError('An error occurred while making the prediction. Please try again.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.querySelector('span').textContent = 'Get Prediction';
      }
    }
  };

  const displayResults = (prediction, confidence, probability) => {
    if (predictionForm) predictionForm.style.display = 'none';
    if (resultsSection) resultsSection.classList.remove('hidden');

    if (resultCard) {
      resultCard.classList.remove('result-success', 'result-danger');
    }

    if (prediction === 'Churn') {
      if (resultCard) resultCard.classList.add('result-danger');
      if (predictionResult) predictionResult.textContent = 'Churn Likely';
    } else {
      if (resultCard) resultCard.classList.add('result-success');
      if (predictionResult) predictionResult.textContent = 'No Churn';
    }

    if (confidenceScore) confidenceScore.textContent = confidence;

    // Animate confidence bar
    if (confidenceBar) {
      const pct = probability ? (probability * 100) : parseFloat(confidence);
      confidenceBar.style.width = '0%';
      requestAnimationFrame(() => {
        confidenceBar.style.width = pct + '%';
      });
    }

    if (resultModelName) resultModelName.textContent = ModelSelector.getLabel();

    if (resultsSection) {
      resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const showError = (message) => {
    alert(message);
  };

  const resetForm = () => {
    if (form) form.reset();
    if (predictionForm) predictionForm.style.display = 'block';
    if (resultsSection) resultsSection.classList.add('hidden');
    if (confidenceBar) confidenceBar.style.width = '0%';
  };

  return { init, resetForm, displayResults };
})();

// ============================================
// Application Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
  ModelSelector.init();
  FormHandler.init();

  window.resetForm = FormHandler.resetForm;

  // Recalculate highlight on resize
  window.addEventListener('resize', () => {
    ModelSelector.init();
  });
});

// ============================================
// Utility Functions
// ============================================

function getTheme() {
  return ThemeManager.getCurrentTheme();
}

function setTheme(theme) {
  ThemeManager.applyTheme(theme);
}

function getAppVersion() {
  return '1.0.0';
}

function validateFormData(formData) {
  const tenure = parseFloat(formData.tenure);
  const monthlyCharges = parseFloat(formData.MonthlyCharges);

  if (isNaN(tenure) || tenure < 0 || tenure > 72) {
    return { valid: false, error: 'Tenure must be between 0 and 72 months' };
  }

  if (isNaN(monthlyCharges) || monthlyCharges < 0) {
    return { valid: false, error: 'Monthly charges must be a positive number' };
  }

  if (!formData.Contract || formData.Contract.trim() === '') {
    return { valid: false, error: 'Please select a contract type' };
  }

  if (!formData.InternetService || formData.InternetService.trim() === '') {
    return { valid: false, error: 'Please select an internet service' };
  }

  return { valid: true };
}
