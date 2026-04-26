/**
 * Churn Prediction Dashboard - Main JavaScript Module
 * Handles theme management, form submission, and prediction display
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

  // DOM Elements
  let themeToggle = null;
  let themeIcon = null;
  let themeLabel = null;
  let body = null;

  /**
   * Initialize theme manager
   */
  const init = () => {
    themeToggle = document.getElementById('themeToggle');
    themeIcon = document.getElementById('themeIcon');
    themeLabel = document.getElementById('themeLabel');
    body = document.body;

    if (!themeToggle) {
      console.warn('Theme toggle element not found');
      return;
    }

    // Load saved theme or default to light
    const savedTheme = localStorage.getItem(STORAGE_KEY) || THEME_LIGHT;
    applyTheme(savedTheme);

    // Add event listener
    themeToggle.addEventListener('click', toggleTheme);
  };

  /**
   * Apply theme to document
   */
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

  /**
   * Toggle between light and dark theme
   */
  const toggleTheme = () => {
    const isDarkMode = body.classList.contains(DARK_MODE_CLASS);
    const newTheme = isDarkMode ? THEME_LIGHT : THEME_DARK;
    applyTheme(newTheme);
  };

  /**
   * Update theme UI elements
   */
  const updateUI = (isDark) => {
    if (themeIcon && themeLabel) {
      if (isDark) {
        themeIcon.textContent = 'Sun';
        themeLabel.textContent = 'Light';
      } else {
        themeIcon.textContent = 'Moon';
        themeLabel.textContent = 'Dark';
      }
    }
  };

  /**
   * Get current theme
   */
  const getCurrentTheme = () => {
    return body.classList.contains(DARK_MODE_CLASS) ? THEME_DARK : THEME_LIGHT;
  };

  return {
    init,
    toggleTheme,
    getCurrentTheme,
    applyTheme
  };
})();

// ============================================
// Form Handler Module
// ============================================

const FormHandler = (() => {
  // DOM Elements
  let form = null;
  let resultsSection = null;
  let predictionForm = null;
  let resultCard = null;
  let predictionResult = null;
  let confidenceScore = null;

  /**
   * Initialize form handler
   */
  const init = () => {
    form = document.getElementById('churnForm');
    resultsSection = document.getElementById('resultsSection');
    predictionForm = document.getElementById('predictionForm');
    resultCard = document.getElementById('resultCard');
    predictionResult = document.getElementById('predictionResult');
    confidenceScore = document.getElementById('confidenceScore');

    if (!form) {
      console.warn('Form element not found');
      return;
    }

    form.addEventListener('submit', handleSubmit);
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    const formData = {
      tenure: document.getElementById('tenure').value,
      MonthlyCharges: document.getElementById('MonthlyCharges').value,
      Contract: document.getElementById('Contract').value,
      InternetService: document.getElementById('InternetService').value
    };

    try {
      const response = await fetch('/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        displayResults(data.prediction, data.confidence);
      } else {
        showError('Error: ' + (data.error || 'Unknown error occurred'));
      }
    } catch (error) {
      console.error('Prediction error:', error);
      showError('An error occurred while making the prediction. Please try again.');
    }
  };

  /**
   * Display prediction results
   */
  const displayResults = (prediction, confidence) => {
    // Hide form, show results
    if (predictionForm) predictionForm.style.display = 'none';
    if (resultsSection) resultsSection.classList.remove('hidden');

    // Clear previous classes
    if (resultCard) {
      resultCard.classList.remove('result-success', 'result-danger');
    }

    // Set prediction result
    if (prediction === 'Churn') {
      if (resultCard) resultCard.classList.add('result-danger');
      if (predictionResult) predictionResult.textContent = 'Churn Likely';
    } else {
      if (resultCard) resultCard.classList.add('result-success');
      if (predictionResult) predictionResult.textContent = 'No Churn';
    }

    if (confidenceScore) {
      confidenceScore.textContent = confidence;
    }

    // Scroll to results
    if (resultsSection) {
      resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  /**
   * Show error message
   */
  const showError = (message) => {
    alert(message);
  };

  /**
   * Reset form to initial state
   */
  const resetForm = () => {
    if (form) form.reset();
    if (predictionForm) predictionForm.style.display = 'block';
    if (resultsSection) resultsSection.classList.add('hidden');
  };

  return {
    init,
    resetForm,
    displayResults
  };
})();

// ============================================
// Application Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Initialize theme manager
  ThemeManager.init();

  // Initialize form handler
  FormHandler.init();

  // Make resetForm globally accessible for inline onclick handlers
  window.resetForm = FormHandler.resetForm;

  console.log('Churn Prediction Dashboard initialized');
});

// ============================================
// Utility Functions
// ============================================

/**
 * Get stored theme preference
 */
function getTheme() {
  return ThemeManager.getCurrentTheme();
}

/**
 * Set theme preference
 */
function setTheme(theme) {
  ThemeManager.applyTheme(theme);
}

/**
 * Log application version
 */
function getAppVersion() {
  return '1.0.0';
}

/**
 * Validate form input
 */
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
