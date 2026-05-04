from flask import Flask, render_template, request, jsonify
import joblib
import pandas as pd
import numpy as np
import os

app = Flask(
    __name__,
    template_folder='../templates',
    static_folder='../static',
    static_url_path='/static'
)

# ── Model Loading ────────────────────────────────────────────────
# Resolve models directory relative to THIS file (api/index.py → ../models/)
_HERE = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(_HERE, '..', 'models')

bundles = {}
for name in ['random_forest', 'xgboost', 'svm', 'gmm', 'dbscan', 'apriori']:
    path = os.path.join(MODELS_DIR, f'{name}.joblib')
    try:
        bundles[name] = joblib.load(path)
        print(f'[OK] Loaded {name}')
    except FileNotFoundError:
        print(f'[MISS] Not found: {path}')
        bundles[name] = None
    except Exception as e:
        print(f'[ERR] Failed to load {name}: {e}')
        bundles[name] = None

SUPERVISED           = {'random_forest', 'xgboost', 'svm'}
UNSUPERVISED_CLUSTER = {'gmm', 'dbscan'}
UNSUPERVISED_RULES   = {'apriori'}

FORM_FIELDS = [
    'tenure', 'MonthlyCharges', 'Contract', 'InternetService',
    'OnlineSecurity', 'TechSupport', 'StreamingTV', 'StreamingMovies',
    'MultipleLines', 'PaymentMethod', 'PaperlessBilling', 'SeniorCitizen'
]

# ── Encoding ─────────────────────────────────────────────────────
def encode_input(data, bundle):
    """Convert raw form payload to model-ready DataFrame."""
    label_encoders  = bundle.get('label_encoders', {})
    feature_columns = bundle.get('feature_columns', FORM_FIELDS)

    row = {}
    for col in feature_columns:
        val = data.get(col, '')
        if col in label_encoders:
            le = label_encoders[col]
            row[col] = int(le.transform([val])[0]) if val in le.classes_ else 0
        else:
            try:
                row[col] = float(val)
            except (TypeError, ValueError):
                row[col] = 0.0

    return pd.DataFrame([row], columns=feature_columns)

# ── Routes ───────────────────────────────────────────────────────
@app.route('/')
def index():
    return render_template('index.html')


@app.route('/predict', methods=['POST'])
def predict():
    try:
        data       = request.get_json(force=True)
        model_name = data.get('model', 'random_forest')

        if model_name not in bundles:
            return jsonify({'success': False,
                            'error': f'Unknown model: {model_name}'}), 400

        bundle = bundles.get(model_name)
        if bundle is None:
            return jsonify({
                'success': False,
                'error': (
                    f"Model '{model_name}' failed to load on the server.\n\n"
                    "Possible causes:\n"
                    "• The .joblib files are missing from the models/ directory\n"
                    "• On Vercel, large model files may exceed the serverless size limit (250 MB)\n"
                    "• Consider hosting models on external storage (S3, GCS) and loading via URL"
                )
            }), 503

        raw = {field: data.get(field, '') for field in FORM_FIELDS}

        if model_name in UNSUPERVISED_RULES:
            return jsonify(predict_apriori(model_name, bundle, raw))

        X = encode_input(raw, bundle)

        if model_name in SUPERVISED:
            return jsonify(predict_supervised(model_name, bundle, X))
        else:
            return jsonify(predict_unsupervised(model_name, bundle, X))

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


# ── Prediction Helpers ───────────────────────────────────────────
def predict_supervised(model_name, bundle, X):
    model = bundle['model']
    if bundle.get('scale_input') and 'scaler' in bundle:
        X_in = bundle['scaler'].transform(X)
    else:
        X_in = X

    proba  = model.predict_proba(X_in)[0]
    pred   = int(model.predict(X_in)[0])
    churn_prob = float(proba[1])

    return {
        'success':    True,
        'model_type': 'supervised',
        'model':      model_name,
        'prediction': 'Churn' if pred == 1 else 'No Churn',
        'probability': round(churn_prob, 4),
        'confidence':  f'{churn_prob * 100:.1f}%',
    }


def predict_unsupervised(model_name, bundle, X):
    model    = bundle['model']
    scaler   = bundle['scaler']
    profiles = bundle.get('cluster_profiles', {})

    X_scaled = scaler.transform(X)

    if model_name == 'gmm':
        cluster_id = int(model.predict(X_scaled)[0])

    elif model_name == 'dbscan':
        pca        = bundle['pca']
        X_pca      = pca.transform(X_scaled)
        core_pts   = model.components_
        dists      = np.linalg.norm(core_pts - X_pca, axis=1)
        nearest    = int(np.argmin(dists))
        cluster_id = int(model.labels_[model.core_sample_indices_[nearest]])

    profile = profiles.get(cluster_id, profiles.get(0, {}))

    return {
        'success':       True,
        'model_type':    'unsupervised',
        'model':         model_name,
        'cluster_id':    cluster_id,
        'cluster_label': f'Segment {cluster_id}',
        'description': (
            f"Avg tenure {profile.get('avg_tenure', '?')} months · "
            f"${profile.get('avg_monthly', '?')}/mo · "
            f"{profile.get('top_contract', '?')} contract"
        ),
        'profile': {
            'avg_tenure':   str(profile.get('avg_tenure',   '?')),
            'avg_monthly':  str(profile.get('avg_monthly',  '?')),
            'top_contract': str(profile.get('top_contract', '?')),
            'size':         str(profile.get('size',         '?')),
        },
    }


# ── Apriori (association-rules) ─────────────────────────────────
def _bin_value(val, bins, labels):
    val = float(val)
    for i in range(len(bins) - 1):
        if bins[i] < val <= bins[i + 1]:
            return labels[i]
    return labels[-1]


def predict_apriori(model_name, bundle, raw):
    """Match customer's items against mined rules; aggregate Churn=Yes/No support."""
    rules = bundle['rules']

    items = set()
    cat_fields = ['Contract', 'InternetService', 'OnlineSecurity', 'TechSupport',
                  'StreamingTV', 'StreamingMovies', 'MultipleLines',
                  'PaymentMethod', 'PaperlessBilling']
    for f in cat_fields:
        v = raw.get(f, '')
        if v:
            items.add(f'{f}={v}')

    if raw.get('tenure', '') != '':
        items.add(_bin_value(raw['tenure'], bundle['tenure_bins'], bundle['tenure_labels']))
    if raw.get('MonthlyCharges', '') != '':
        items.add(_bin_value(raw['MonthlyCharges'], bundle['monthly_bins'], bundle['monthly_labels']))
    senior = raw.get('SeniorCitizen', '0')
    items.add('senior=Yes' if str(senior) == '1' else 'senior=No')

    matched_yes = []
    matched_no  = []
    for rule in rules:
        ant = set(rule['antecedents'])
        if ant.issubset(items):
            entry = {
                'antecedents': list(ant),
                'consequent':  rule['consequents'],
                'confidence':  round(float(rule['confidence']), 3),
                'lift':        round(float(rule['lift']), 3),
                'support':     round(float(rule['support']), 3),
            }
            if rule['consequents'] == 'Churn=Yes':
                matched_yes.append(entry)
            else:
                matched_no.append(entry)

    matched_yes.sort(key=lambda r: r['lift'], reverse=True)
    matched_no.sort(key=lambda r: r['lift'], reverse=True)

    def avg_conf(rules_list):
        if not rules_list:
            return None
        top = rules_list[:5]
        return sum(r['confidence'] for r in top) / len(top)

    yes_conf  = avg_conf(matched_yes)
    no_conf   = avg_conf(matched_no)
    base_rate = bundle.get('churn_base_rate', 0.27)

    if yes_conf is None and no_conf is None:
        verdict = 'No Strong Pattern'
        score   = base_rate
    elif yes_conf is None:
        verdict = 'No Churn Pattern'
        score   = 1 - no_conf
    elif no_conf is None:
        verdict = 'Churn Pattern'
        score   = yes_conf
    else:
        if yes_conf >= no_conf:
            verdict = 'Churn Pattern'
            score   = yes_conf
        else:
            verdict = 'No Churn Pattern'
            score   = 1 - no_conf

    return {
        'success':           True,
        'model_type':        'rules',
        'model':             model_name,
        'verdict':           verdict,
        'score':             round(float(score), 4),
        'confidence':        f'{score * 100:.1f}%',
        'matched_yes_count': len(matched_yes),
        'matched_no_count':  len(matched_no),
        'top_rules':         (matched_yes[:3] + matched_no[:3]),
        'base_rate':         round(float(base_rate), 4),
    }


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
