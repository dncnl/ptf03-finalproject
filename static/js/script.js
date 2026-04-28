/**
 * Churn Prediction Dashboard - JavaScript
 * Handles form submission, theme toggling, and UI interactions
 */

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", function () {
  initThemeToggle();
  initModelSelector();
  initFormSubmission();
  loadThemePreference();
});

/**
 * Initialize theme toggle functionality
 */
function initThemeToggle() {
  const themeToggle = document.getElementById("themeToggle");
  const htmlElement = document.documentElement;
  const sunIcon = document.getElementById("themeIconSun");
  const moonIcon = document.getElementById("themeIconMoon");

  themeToggle.addEventListener("click", function () {
    const isDarkMode = htmlElement.classList.toggle("dark-mode");

    // Update icons
    if (isDarkMode) {
      sunIcon.classList.remove("hidden");
      moonIcon.classList.add("hidden");
      localStorage.setItem("theme", "dark");
    } else {
      sunIcon.classList.add("hidden");
      moonIcon.classList.remove("hidden");
      localStorage.setItem("theme", "light");
    }
  });
}

/**
 * Load saved theme preference from localStorage
 */
function loadThemePreference() {
  const savedTheme = localStorage.getItem("theme");
  const htmlElement = document.documentElement;
  const sunIcon = document.getElementById("themeIconSun");
  const moonIcon = document.getElementById("themeIconMoon");

  if (savedTheme === "dark") {
    htmlElement.classList.add("dark-mode");
    sunIcon.classList.remove("hidden");
    moonIcon.classList.add("hidden");
  } else {
    htmlElement.classList.remove("dark-mode");
    sunIcon.classList.add("hidden");
    moonIcon.classList.remove("hidden");
  }
}

/**
 * Initialize model selector functionality
 */
function initModelSelector() {
  const modelSelector = document.getElementById("modelSelector");
  const modelOptions = modelSelector.querySelectorAll(".model-option");
  const modelHighlight = document.getElementById("modelHighlight");

  // Update highlight position when a model is selected
  function updateHighlight(activeButton) {
    const buttonRect = activeButton.getBoundingClientRect();
    const selectorRect = modelSelector.getBoundingClientRect();

    const left = buttonRect.left - selectorRect.left;
    const width = buttonRect.width;

    modelHighlight.style.transform = `translateX(${left - 4}px)`;
    modelHighlight.style.width = `${width}px`;
  }

  modelOptions.forEach((option) => {
    option.addEventListener("click", function () {
      // Update active state
      modelOptions.forEach((opt) => opt.classList.remove("active"));
      this.classList.add("active");

      // Update highlight
      updateHighlight(this);
    });
  });

  // Initialize highlight position on load
  const activeButton = modelSelector.querySelector(".model-option.active");
  if (activeButton) {
    updateHighlight(activeButton);
  }

  // Update highlight on window resize
  window.addEventListener("resize", function () {
    const activeButton = modelSelector.querySelector(".model-option.active");
    if (activeButton) {
      updateHighlight(activeButton);
    }
  });
}

/**
 * Initialize form submission
 */
function initFormSubmission() {
  const churnForm = document.getElementById("churnForm");
  const submitBtn = document.getElementById("submitBtn");

  churnForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    // Get form data
    const formData = new FormData(churnForm);
    const tenure = formData.get("tenure");
    const monthlyCharges = formData.get("MonthlyCharges");
    const contract = formData.get("Contract");
    const internetService = formData.get("InternetService");

    // Get selected model
    const modelSelector = document.getElementById("modelSelector");
    const selectedModel = modelSelector.querySelector(".model-option.active");
    const model = selectedModel
      ? selectedModel.getAttribute("data-model")
      : "random_forest";

    // Disable submit button during request
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span style="opacity: 0.7;">Processing...</span>';

    try {
      const response = await fetch("/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenure,
          MonthlyCharges: monthlyCharges,
          Contract: contract,
          InternetService: internetService,
          model,
        }),
      });

      const result = await response.json();

      if (result.success) {
        displayResults(result);
      } else {
        showError(result.error || "Prediction failed");
      }
    } catch (error) {
      console.error("Error:", error);
      showError("Network error - could not reach server");
    } finally {
      // Re-enable submit button
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                </svg>
                <span>Get Prediction</span>
            `;
    }
  });
}

/**
 * Display prediction results
 */
function displayResults(result) {
  const predictionForm = document.getElementById("predictionForm");
  const resultsSection = document.getElementById("resultsSection");
  const resultCard = document.getElementById("resultCard");
  const predictionResult = document.getElementById("predictionResult");
  const confidenceBar = document.getElementById("confidenceBar");
  const confidenceScore = document.getElementById("confidenceScore");
  const resultModelName = document.getElementById("resultModelName");

  // Hide form, show results
  predictionForm.classList.add("hidden");
  resultsSection.classList.remove("hidden");

  // Update result card styling based on prediction
  const isChurn = result.prediction === "Churn";
  resultCard.classList.remove("result-success", "result-danger");
  resultCard.classList.add(isChurn ? "result-danger" : "result-success");

  // Update result values
  predictionResult.textContent = result.prediction;
  confidenceScore.textContent = result.confidence;
  resultModelName.textContent = formatModelName(result.model);

  // Animate confidence bar
  const confidenceValue = parseFloat(result.confidence);
  confidenceBar.style.width = "0%";

  // Trigger animation after a small delay
  setTimeout(() => {
    confidenceBar.style.width = `${confidenceValue}%`;
  }, 100);

  // Scroll to results
  resultsSection.scrollIntoView({ behavior: "smooth", block: "center" });
}

/**
 * Format model name for display
 */
function formatModelName(model) {
  const modelNames = {
    random_forest: "Random Forest",
    xgboost: "XGBoost",
    gmm: "Gaussian Mixture Model",
    dbscan: "DBSCAN",
  };
  return modelNames[model] || model;
}

/**
 * Show error message
 */
function showError(message) {
  alert(`Error: ${message}`);
}

/**
 * Reset form and return to input
 */
function resetForm() {
  const churnForm = document.getElementById("churnForm");
  const predictionForm = document.getElementById("predictionForm");
  const resultsSection = document.getElementById("resultsSection");

  churnForm.reset();
  predictionForm.classList.remove("hidden");
  resultsSection.classList.add("hidden");

  // Scroll back to form
  predictionForm.scrollIntoView({ behavior: "smooth", block: "center" });
}
