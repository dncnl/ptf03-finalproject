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
for name in ['random_forest', 'xgboost', 'svm', 'gmm', 'dbscan', 'kmeans']:
    path = os.path.join(models_dir, f'{name}.joblib')
    bundles[name] = joblib.load(path)
    print(f'Loaded {name}: {list(bundles[name].keys())}')

SUPERVISED = ['random_forest', 'xgboost', 'svm']
UNSUPERVISED_CLUSTER = ['gmm', 'dbscan', 'kmeans']

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


def _to_float(v, default=0.0):
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def risk_for_profile(profile, cluster_id):
    """Heuristic churn-risk scoring derived from a segment's profile.

    Tenure (low = risky), contract type (month-to-month = risky), and
    monthly charges (high = mildly risky) drive the score. DBSCAN's noise
    cluster (-1) is reported as 'Outliers' rather than scored.
    """
    if cluster_id == -1:
        return {'tier': 'outlier', 'label': 'Outliers', 'score': None}

    tenure = _to_float(profile.get('avg_tenure'))
    monthly = _to_float(profile.get('avg_monthly'))
    contract = str(profile.get('top_contract', '')).lower()

    score = 0
    if tenure < 12:    score += 40
    elif tenure < 24:  score += 28
    elif tenure < 48:  score += 14

    if 'month-to-month' in contract:   score += 40
    elif 'one year' in contract:       score += 18
    elif 'two year' in contract:       score += 0
    else:                              score += 20

    if monthly >= 80:   score += 20
    elif monthly >= 60: score += 12
    elif monthly >= 40: score += 6

    if score >= 65:
        tier, label = 'high', 'High Risk'
    elif score >= 35:
        tier, label = 'medium', 'Medium Risk'
    else:
        tier, label = 'low', 'Low Risk'

    return {'tier': tier, 'label': label, 'score': score}


def predict_cluster(model_name, bundle, X):
    model = bundle['model']
    scaler = bundle['scaler']
    profiles = bundle['cluster_profiles']

    X_scaled = scaler.transform(X)

    if model_name == 'gmm' or model_name == 'kmeans':
        cluster_id = int(model.predict(X_scaled)[0])
    elif model_name == 'dbscan':
        pca = bundle['pca']
        X_pca = pca.transform(X_scaled)
        core_samples = model.components_
        distances = np.linalg.norm(core_samples - X_pca, axis=1)
        nearest_idx = np.argmin(distances)
        cluster_id = int(model.labels_[model.core_sample_indices_[nearest_idx]])

    profile = profiles.get(cluster_id, profiles.get(0, {}))
    assigned_risk = risk_for_profile(profile, cluster_id)

    all_segments = []
    for cid, p in sorted(profiles.items(), key=lambda kv: kv[0]):
        cid_int = int(cid)
        risk = risk_for_profile(p, cid_int)
        all_segments.append({
            'cluster_id': cid_int,
            'cluster_label': 'Noise' if cid_int == -1 else f'Segment {cid_int}',
            'is_assigned': cid_int == cluster_id,
            'avg_tenure': str(p.get('avg_tenure', '?')),
            'avg_monthly': str(p.get('avg_monthly', '?')),
            'top_contract': str(p.get('top_contract', '?')),
            'size': str(p.get('size', '?')),
            'risk_tier': risk['tier'],
            'risk_label': risk['label'],
            'risk_score': risk['score']
        })

    return {
        'success': True,
        'model_type': 'unsupervised',
        'model': model_name,
        'cluster_id': cluster_id,
        'cluster_label': 'Noise' if cluster_id == -1 else f'Segment {cluster_id}',
        'description': f'Avg {profile.get("avg_tenure", "?")} months tenure, '
                        f'${profile.get("avg_monthly", "?")}/mo, '
                        f'{profile.get("top_contract", "?")} contract',
        'profile': {
            'avg_tenure': str(profile.get('avg_tenure', '?')),
            'avg_monthly': str(profile.get('avg_monthly', '?')),
            'top_contract': str(profile.get('top_contract', '?')),
            'size': str(profile.get('size', '?'))
        },
        'risk_tier': assigned_risk['tier'],
        'risk_label': assigned_risk['label'],
        'risk_score': assigned_risk['score'],
        'all_segments': all_segments
    }


if __name__ == '__main__':
    app.run(debug=True)
