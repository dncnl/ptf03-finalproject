from flask import Flask, render_template, request, jsonify
import joblib
import pandas as pd
import numpy as np
import os

# Configure Flask with absolute paths for Vercel serverless compatibility
app = Flask(
    __name__,
    template_folder=os.path.abspath(os.path.join(os.path.dirname(__file__), '../templates')),
    static_folder=os.path.abspath(os.path.join(os.path.dirname(__file__), '../static')),
    static_url_path='/static'
)

models_dir = os.path.join(os.path.dirname(__file__), '..', 'models')

bundles = {}
for name in ['random_forest', 'xgboost', 'svm', 'gmm', 'dbscan', 'apriori']:
    path = os.path.join(models_dir, f'{name}.joblib')
    bundles[name] = joblib.load(path)
    print(f'Loaded {name}: {list(bundles[name].keys())}')

SUPERVISED = ['random_forest', 'xgboost', 'svm']
UNSUPERVISED_CLUSTER = ['gmm', 'dbscan']
UNSUPERVISED_RULES = ['apriori']

FORM_FIELDS = [
    'tenure', 'MonthlyCharges', 'Contract', 'InternetService',
    'OnlineSecurity', 'TechSupport', 'StreamingTV', 'StreamingMovies',
    'MultipleLines', 'PaymentMethod', 'PaperlessBilling', 'SeniorCitizen'
]


def encode_input(data, bundle):
    """Convert raw form input to model-ready DataFrame."""
    label_encoders = bundle['label_encoders']
    feature_columns = bundle['feature_columns']

    row = {}
    for col in feature_columns:
        if col in data:
            val = data[col]
            if col in label_encoders:
                le = label_encoders[col]
                if val in le.classes_:
                    row[col] = le.transform([val])[0]
                else:
                    row[col] = 0
            else:
                row[col] = float(val)
        else:
            row[col] = 0

    df = pd.DataFrame([row], columns=feature_columns)
    return df


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        model_name = data.get('model', 'random_forest')

        if model_name not in bundles:
            return jsonify({'success': False, 'error': f'Unknown model: {model_name}'}), 400

        bundle = bundles[model_name]
        raw_features = {field: data.get(field, '') for field in FORM_FIELDS}

        if model_name in SUPERVISED:
            X = encode_input(raw_features, bundle)
            return jsonify(predict_supervised(model_name, bundle, X))
        elif model_name in UNSUPERVISED_CLUSTER:
            X = encode_input(raw_features, bundle)
            return jsonify(predict_cluster(model_name, bundle, X))
        elif model_name in UNSUPERVISED_RULES:
            return jsonify(predict_apriori(model_name, bundle, raw_features))

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


def predict_supervised(model_name, bundle, X):
    model = bundle['model']
    if bundle.get('scale_input') and 'scaler' in bundle:
        X_in = bundle['scaler'].transform(X)
    else:
        X_in = X

    prediction = model.predict(X_in)[0]
    proba = model.predict_proba(X_in)[0]
    churn_prob = float(proba[1])

    return {
        'success': True,
        'model_type': 'supervised',
        'model': model_name,
        'prediction': 'Churn' if prediction == 1 else 'No Churn',
        'probability': round(churn_prob, 4),
        'confidence': f'{churn_prob * 100:.1f}%'
    }


def predict_cluster(model_name, bundle, X):
    model = bundle['model']
    scaler = bundle['scaler']
    profiles = bundle['cluster_profiles']

    X_scaled = scaler.transform(X)

    if model_name == 'gmm':
        cluster_id = int(model.predict(X_scaled)[0])
    elif model_name == 'dbscan':
        pca = bundle['pca']
        X_pca = pca.transform(X_scaled)
        core_samples = model.components_
        distances = np.linalg.norm(core_samples - X_pca, axis=1)
        nearest_idx = np.argmin(distances)
        cluster_id = int(model.labels_[model.core_sample_indices_[nearest_idx]])

    profile = profiles.get(cluster_id, profiles.get(0, {}))

    return {
        'success': True,
        'model_type': 'unsupervised',
        'model': model_name,
        'cluster_id': cluster_id,
        'cluster_label': f'Segment {cluster_id}',
        'description': f'Avg {profile.get("avg_tenure", "?")} months tenure, '
                        f'${profile.get("avg_monthly", "?")}/mo, '
                        f'{profile.get("top_contract", "?")} contract',
        'profile': {
            'avg_tenure': str(profile.get('avg_tenure', '?')),
            'avg_monthly': str(profile.get('avg_monthly', '?')),
            'top_contract': str(profile.get('top_contract', '?')),
            'size': str(profile.get('size', '?'))
        }
    }


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
    matched_no = []
    for rule in rules:
        ant = set(rule['antecedents'])
        if ant.issubset(items):
            entry = {
                'antecedents': list(ant),
                'consequent': rule['consequents'],
                'confidence': round(float(rule['confidence']), 3),
                'lift': round(float(rule['lift']), 3),
                'support': round(float(rule['support']), 3),
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

    yes_conf = avg_conf(matched_yes)
    no_conf = avg_conf(matched_no)
    base_rate = bundle.get('churn_base_rate', 0.27)

    if yes_conf is None and no_conf is None:
        verdict = 'No Strong Pattern'
        score = base_rate
    elif yes_conf is None:
        verdict = 'No Churn Pattern'
        score = 1 - no_conf
    elif no_conf is None:
        verdict = 'Churn Pattern'
        score = yes_conf
    else:
        if yes_conf >= no_conf:
            verdict = 'Churn Pattern'
            score = yes_conf
        else:
            verdict = 'No Churn Pattern'
            score = 1 - no_conf

    return {
        'success': True,
        'model_type': 'rules',
        'model': model_name,
        'verdict': verdict,
        'score': round(float(score), 4),
        'confidence': f'{score * 100:.1f}%',
        'matched_yes_count': len(matched_yes),
        'matched_no_count': len(matched_no),
        'top_rules': (matched_yes[:3] + matched_no[:3]),
        'base_rate': round(float(base_rate), 4),
    }


if __name__ == '__main__':
    app.run(debug=True)
