/**
 * Churn Prediction Dashboard — JavaScript
 * Handles form submission, theme toggling, model selector, and result display.
 */

document.addEventListener('DOMContentLoaded', function () {
  loadThemePreference();
  initThemeToggle();
  initModelSelector();
  initFormSubmission();
});

/* ── Theme ──────────────────────────────────────────────────── */

function initThemeToggle() {
  const btn      = document.getElementById('themeToggle');
  const sunIcon  = document.getElementById('themeIconSun');
  const moonIcon = document.getElementById('themeIconMoon');
  const html     = document.documentElement;

  btn.addEventListener('click', function () {
    const dark = html.classList.toggle('dark-mode');
    sunIcon.classList.toggle('hidden', !dark);
    moonIcon.classList.toggle('hidden', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  });
}

function loadThemePreference() {
  const saved    = localStorage.getItem('theme');
  const html     = document.documentElement;
  const sunIcon  = document.getElementById('themeIconSun');
  const moonIcon = document.getElementById('themeIconMoon');
  const dark     = saved === 'dark' ||
    (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);

  html.classList.toggle('dark-mode', dark);
  if (sunIcon)  sunIcon.classList.toggle('hidden', !dark);
  if (moonIcon) moonIcon.classList.toggle('hidden', dark);
}

/* ── Model Selector ─────────────────────────────────────────── */

function initModelSelector() {
  const selector  = document.getElementById('modelSelector');
  const options   = selector.querySelectorAll('.model-option');
  const highlight = document.getElementById('modelHighlight');

  function moveHighlight(btn) {
    const sr = selector.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    highlight.style.width     = `${br.width}px`;
    highlight.style.transform = `translateX(${br.left - sr.left - 4}px)`;
  }

  options.forEach(opt => {
    opt.addEventListener('click', function () {
      options.forEach(o => o.classList.remove('active'));
      this.classList.add('active');
      moveHighlight(this);
      updateMetricsDisplay(this.getAttribute('data-model'));
    });
  });

  const active = selector.querySelector('.model-option.active');
  if (active) {
    requestAnimationFrame(() => moveHighlight(active));
    updateMetricsDisplay(active.getAttribute('data-model'));
  }

  window.addEventListener('resize', () => {
    const a = selector.querySelector('.model-option.active');
    if (a) moveHighlight(a);
  });
}

/* ── Metrics Per Model ──────────────────────────────────────── */

const MODEL_METRICS = {
  random_forest: [
    { value: '76.6%', label: 'Accuracy',  desc: 'Overall correct predictions' },
    { value: '54.3%', label: 'Precision', desc: 'True positive rate' },
    { value: '74.3%', label: 'Recall',    desc: 'Detection sensitivity' },
    { value: '62.8%', label: 'F1 Score',  desc: 'Balanced harmonic mean' },
    { value: '0.834', label: 'AUC-ROC',   desc: 'Model discrimination' },
    { value: '63.9%', label: 'Avg Prec.', desc: 'Area under PR curve' },
  ],
  xgboost: [
    { value: '73.8%', label: 'Accuracy',  desc: 'Overall correct predictions' },
    { value: '50.4%', label: 'Precision', desc: 'True positive rate' },
    { value: '80.0%', label: 'Recall',    desc: 'Detection sensitivity' },
    { value: '61.8%', label: 'F1 Score',  desc: 'Balanced harmonic mean' },
    { value: '0.839', label: 'AUC-ROC',   desc: 'Model discrimination' },
    { value: '65.2%', label: 'Avg Prec.', desc: 'Area under PR curve' },
  ],
  svm: [
    { value: '74.4%', label: 'Accuracy',  desc: 'Overall correct predictions' },
    { value: '51.2%', label: 'Precision', desc: 'True positive rate' },
    { value: '77.0%', label: 'Recall',    desc: 'Detection sensitivity' },
    { value: '61.5%', label: 'F1 Score',  desc: 'Balanced harmonic mean' },
    { value: '~0.83', label: 'AUC-ROC',   desc: 'Model discrimination' },
    { value: 'RBF',   label: 'Kernel',    desc: 'Non-linear boundary' },
  ],
  gmm: [
    { value: '9',     label: 'Clusters',       desc: 'BIC-selected components' },
    { value: '0.081', label: 'Silhouette',     desc: 'Cohesion vs separation' },
    { value: '2.65',  label: 'Davies-Bouldin', desc: 'Lower is better' },
    { value: '471',   label: 'Calinski-H.',    desc: 'Higher is better' },
    { value: 'Soft',  label: 'Assignment',     desc: 'Probabilistic membership' },
    { value: 'Full',  label: 'Covariance',     desc: 'Per-cluster shape' },
  ],
  dbscan: [
    { value: '9',      label: 'Clusters',       desc: 'Density-based groups' },
    { value: '-0.16',  label: 'Silhouette',     desc: 'Negative = overlap' },
    { value: '1.29',   label: 'Davies-Bouldin', desc: 'Lower is better' },
    { value: '105',    label: 'Calinski-H.',    desc: 'Higher is better' },
    { value: '7.9%',   label: 'Noise',          desc: 'Unassigned points' },
    { value: 'Hard',   label: 'Assignment',     desc: 'PCA pre-reduced' },
  ],
  apriori: [
    { value: '300',    label: 'Rules',          desc: 'Top by lift retained' },
    { value: '0.05',   label: 'Min Support',    desc: 'Frequency threshold' },
    { value: '0.50',   label: 'Min Confidence', desc: 'P(consequent | ant)' },
    { value: '2.72',   label: 'Top Lift',       desc: 'Strongest churn rule' },
    { value: '~30K',   label: 'Frequent Sets',  desc: 'Itemsets mined' },
    { value: 'Yes/No', label: 'Consequent',     desc: 'Churn outcome' },
  ],
};

function updateMetricsDisplay(modelKey) {
  const metrics = MODEL_METRICS[modelKey];
  if (!metrics) return;
  metrics.forEach((m, i) => {
    const v = document.querySelector(`[data-metric="${i}"]`);
    const l = document.querySelector(`[data-metric-label="${i}"]`);
    const d = document.querySelector(`[data-metric-desc="${i}"]`);
    if (v) v.textContent = m.value;
    if (l) l.textContent = m.label;
    if (d) d.textContent = m.desc;
  });
}

/* ── Form Submission ────────────────────────────────────────── */

function initFormSubmission() {
  const form      = document.getElementById('churnForm');
  const submitBtn = document.getElementById('submitBtn');

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    // Collect ALL 12 fields the backend expects
    const fd = new FormData(form);
    const payload = {
      model:           getActiveModel(),
      tenure:          fd.get('tenure'),
      MonthlyCharges:  fd.get('MonthlyCharges'),
      Contract:        fd.get('Contract'),
      InternetService: fd.get('InternetService'),
      OnlineSecurity:  fd.get('OnlineSecurity'),
      TechSupport:     fd.get('TechSupport'),
      StreamingTV:     fd.get('StreamingTV'),
      StreamingMovies: fd.get('StreamingMovies'),
      MultipleLines:   fd.get('MultipleLines'),
      PaymentMethod:   fd.get('PaymentMethod'),
      PaperlessBilling:fd.get('PaperlessBilling'),
      SeniorCitizen:   fd.get('SeniorCitizen'),
    };

    setSubmitLoading(submitBtn, true);

    try {
      const res    = await fetch('/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (result.success) {
        displayResults(result);
      } else {
        showError(result.error || 'Prediction failed. Please try again.');
      }
    } catch (err) {
      console.error(err);
      showError('Network error — could not reach the server. Please check your connection.');
    } finally {
      setSubmitLoading(submitBtn, false);
    }
  });
}

function getActiveModel() {
  const selector = document.getElementById('modelSelector');
  const active   = selector.querySelector('.model-option.active');
  return active ? active.getAttribute('data-model') : 'random_forest';
}

function setSubmitLoading(btn, loading) {
  btn.disabled = loading;
  btn.innerHTML = loading
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin .8s linear infinite">
         <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0"/>
       </svg>
       <span>Running...</span>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
         <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
       </svg>
       <span>Run Prediction</span>`;
}

/* CSS for spinner */
(function () {
  const s = document.createElement('style');
  s.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(s);
})();

/* ── Display Results ─────────────────────────────────────────── */

function displayResults(result) {
  const placeholder       = document.getElementById('resultsPlaceholder');
  const supervisedResult  = document.getElementById('supervisedResult');
  const unsupervisedResult= document.getElementById('unsupervisedResult');
  const rulesResult       = document.getElementById('rulesResult');

  placeholder.classList.add('hidden');
  supervisedResult.classList.add('hidden');
  unsupervisedResult.classList.add('hidden');
  if (rulesResult) rulesResult.classList.add('hidden');

  if (result.model_type === 'supervised') {
    supervisedResult.classList.remove('hidden');
    displaySupervisedResult(result);
  } else if (result.model_type === 'rules') {
    if (rulesResult) rulesResult.classList.remove('hidden');
    displayRulesResult(result);
  } else {
    unsupervisedResult.classList.remove('hidden');
    displayUnsupervisedResult(result);
  }

  document.getElementById('resultsSection')
    .scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function displaySupervisedResult(result) {
  const isChurn  = result.prediction === 'Churn';
  const prob     = result.probability || 0;
  const pct      = Math.round(prob * 100);

  // Icon
  const visual = document.getElementById('predictionVisual');
  visual.innerHTML = isChurn ? '⚠️' : '✅';
  visual.className = `prediction-icon-wrap ${isChurn ? 'churn' : 'no-churn'}`;

  // Text
  const predEl = document.getElementById('predictionResult');
  predEl.textContent = result.prediction;
  predEl.className   = `result-value result-prediction ${isChurn ? 'churn' : 'no-churn'}`;

  // Confidence bar
  document.getElementById('confidenceScore').textContent = `${pct}%`;
  const bar = document.getElementById('confidenceBar');
  bar.style.width = '0%';
  // Dynamically color bar based on probability
  bar.style.background = isChurn
    ? 'linear-gradient(90deg, hsl(4,74%,52%), hsl(4,74%,62%))'
    : 'linear-gradient(90deg, hsl(152,60%,42%), hsl(152,60%,52%))';
  requestAnimationFrame(() => setTimeout(() => { bar.style.width = `${pct}%`; }, 60));

  // Stats
  document.getElementById('resultModelName').textContent  = formatModelName(result.model);
  const level = prob >= 0.7 ? 'High' : prob >= 0.4 ? 'Medium' : 'Low';
  document.getElementById('confidenceBadge').textContent = level;
}

function displayUnsupervisedResult(result) {
  document.getElementById('clusterName').textContent        = result.cluster_label || `Segment ${result.cluster_id}`;
  document.getElementById('clusterDescription').textContent = result.description || '';
  document.getElementById('profileTenure').textContent      = result.profile?.avg_tenure  || '—';
  document.getElementById('profileCharges').textContent     = result.profile?.avg_monthly || '—';
  document.getElementById('profileContract').textContent    = result.profile?.top_contract|| '—';
  document.getElementById('profileSize').textContent        = result.profile?.size        || '—';
  document.getElementById('resultModelNameUnsup').textContent = formatModelName(result.model);

  const visual = document.getElementById('clusterVisual');
  visual.innerHTML = '🎯';
}

function displayRulesResult(result) {
  document.getElementById('rulesVerdict').textContent = result.verdict || '—';

  const score = result.score || 0;
  const pct   = Math.round(score * 100);
  document.getElementById('rulesScore').textContent = `${pct}%`;
  const bar = document.getElementById('rulesBar');
  bar.style.width = '0%';
  const isChurn = result.verdict === 'Churn Pattern';
  bar.style.background = isChurn
    ? 'linear-gradient(90deg, hsl(4,74%,52%), hsl(4,74%,62%))'
    : 'linear-gradient(90deg, hsl(152,60%,42%), hsl(152,60%,52%))';
  requestAnimationFrame(() => setTimeout(() => { bar.style.width = `${pct}%`; }, 60));

  document.getElementById('rulesYesCount').textContent = result.matched_yes_count ?? 0;
  document.getElementById('rulesNoCount').textContent  = result.matched_no_count  ?? 0;
  document.getElementById('rulesBaseRate').textContent = `${Math.round((result.base_rate || 0) * 100)}%`;
  document.getElementById('resultModelNameRules').textContent = formatModelName(result.model);

  const list = document.getElementById('rulesList');
  list.innerHTML = '';
  (result.top_rules || []).forEach(r => {
    const cls = r.consequent === 'Churn=Yes' ? 'rule-yes' : 'rule-no';
    const item = document.createElement('div');
    item.className = `rule-item ${cls}`;
    item.innerHTML = `
      <div class="rule-ant">${r.antecedents.map(escapeHtml).join(' &nbsp;+&nbsp; ')}</div>
      <div class="rule-arrow">&rarr; ${escapeHtml(r.consequent)}</div>
      <div class="rule-stats">conf ${Math.round(r.confidence * 100)}% &middot; lift ${r.lift.toFixed(2)}</div>
    `;
    list.appendChild(item);
  });
}

/* ── Helpers ─────────────────────────────────────────────────── */

function formatModelName(model) {
  const names = {
    random_forest: 'Random Forest',
    xgboost:       'XGBoost',
    svm:           'Support Vector Machine',
    gmm:           'Gaussian Mixture Model',
    dbscan:        'DBSCAN',
    apriori:       'Apriori',
  };
  return names[model] || model;
}

function showError(message) {
  // Remove any existing modal
  document.getElementById('errorModal')?.remove();
  document.getElementById('errorBackdrop')?.remove();

  const dark    = document.documentElement.classList.contains('dark-mode');
  const bg      = dark ? '#1a1d2a' : '#ffffff';
  const text    = dark ? '#c8cce0' : '#3d4056';
  const overlay = dark ? 'rgba(0,0,0,.75)' : 'rgba(0,0,0,.5)';

  const dismiss = `document.getElementById('errorModal')?.remove();
                   document.getElementById('errorBackdrop')?.remove();`;

  document.body.insertAdjacentHTML('beforeend', `
    <div id="errorBackdrop" onclick="${dismiss}" style="
      position:fixed;inset:0;background:${overlay};z-index:9998;
    "></div>
    <div id="errorModal" style="
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:${bg};color:${text};
      border-radius:14px;padding:2rem;max-width:480px;width:90%;
      box-shadow:0 24px 64px rgba(0,0,0,.35);
      border:1px solid rgba(220,40,40,.35);
      border-left:4px solid #da2828;z-index:9999;
    ">
      <h3 style="color:#da2828;font-size:1rem;font-weight:700;margin-bottom:.75rem;">
        Prediction Error
      </h3>
      <p style="font-size:.875rem;line-height:1.6;white-space:pre-wrap;word-break:break-word;margin-bottom:1.25rem;">
        ${escapeHtml(message)}
      </p>
      <button onclick="${dismiss}" style="
        background:#da2828;color:#fff;border:none;
        padding:.5rem 1.25rem;border-radius:8px;
        font-weight:600;font-size:.875rem;cursor:pointer;font-family:inherit;
      ">Dismiss</button>
    </div>
  `);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function resetForm() {
  document.getElementById('churnForm').reset();

  // Show placeholder again
  document.getElementById('resultsPlaceholder').classList.remove('hidden');
  document.getElementById('supervisedResult').classList.add('hidden');
  document.getElementById('unsupervisedResult').classList.add('hidden');
  document.getElementById('rulesResult')?.classList.add('hidden');

  // Scroll back to form
  document.getElementById('predictionForm')
    .scrollIntoView({ behavior: 'smooth', block: 'start' });
}
