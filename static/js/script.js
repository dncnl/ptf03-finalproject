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
  const supervisedResult = document.getElementById("supervisedResult");
  const unsupervisedResult = document.getElementById("unsupervisedResult");

  // Hide form, show results
  predictionForm.classList.add("hidden");
  resultsSection.classList.remove("hidden");

  // Display appropriate result based on model type
  if (result.model_type === "supervised") {
    displaySupervisedResult(result);
    supervisedResult.classList.remove("hidden");
    unsupervisedResult.classList.add("hidden");
  } else {
    displayUnsupervisedResult(result);
    supervisedResult.classList.add("hidden");
    unsupervisedResult.classList.remove("hidden");
  }

  // Scroll to results
  resultsSection.scrollIntoView({ behavior: "smooth", block: "center" });
}

/**
 * Display supervised prediction result with visual indicators
 */
function displaySupervisedResult(result) {
  const predictionResult = document.getElementById("predictionResult");
  const confidenceBar = document.getElementById("confidenceBar");
  const confidenceScore = document.getElementById("confidenceScore");
  const confidenceBadge = document.getElementById("confidenceBadge");
  const resultModelName = document.getElementById("resultModelName");
  const predictionVisual = document.getElementById("predictionVisual");

  // Extract probability value
  const probability = result.probability || 0;
  const confidencePercent = Math.round(probability * 100);

  // Update prediction result
  const isChurn = result.prediction === "Churn";
  predictionResult.textContent = result.prediction;
  predictionResult.classList.remove("churn", "no-churn");
  predictionResult.classList.add(isChurn ? "churn" : "no-churn");

  // Update confidence score
  confidenceScore.textContent = `${confidencePercent}%`;
  confidenceScore.classList.add("confidence-percentage");

  // Update confidence badge
  let badgeText = "Low";
  if (probability >= 0.7) badgeText = "High";
  else if (probability >= 0.4) badgeText = "Medium";
  confidenceBadge.textContent = badgeText;

  // Update model name
  resultModelName.textContent = formatModelName(result.model);

  // Update prediction visual icon
  predictionVisual.innerHTML = isChurn ? "⚠️" : "✅";
  predictionVisual.classList.remove("churn", "no-churn");
  predictionVisual.classList.add(isChurn ? "churn" : "no-churn");

  // Animate confidence bar
  confidenceBar.style.width = "0%";
  setTimeout(() => {
    confidenceBar.style.width = `${confidencePercent}%`;
  }, 100);
}

/**
 * Display unsupervised clustering result
 */
function displayUnsupervisedResult(result) {
  const clusterName = document.getElementById("clusterName");
  const clusterDescription = document.getElementById("clusterDescription");
  const profileTenure = document.getElementById("profileTenure");
  const profileCharges = document.getElementById("profileCharges");
  const profileContract = document.getElementById("profileContract");
  const profileSize = document.getElementById("profileSize");
  const resultModelNameUnsup = document.getElementById("resultModelNameUnsup");
  const clusterVisual = document.getElementById("clusterVisual");

  // Update cluster information
  clusterName.textContent = result.cluster_label || `Segment ${result.cluster_id}`;
  clusterDescription.textContent = result.description;

  // Update profile stats
  profileTenure.textContent = result.profile?.avg_tenure || "N/A";
  profileCharges.textContent = result.profile?.avg_monthly || "N/A";
  profileContract.textContent = result.profile?.top_contract || "N/A";
  profileSize.textContent = result.profile?.size || "N/A";

  // Update model name
  resultModelNameUnsup.textContent = formatModelName(result.model);

  // Update cluster visual icon
  clusterVisual.innerHTML = "🎯";
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
