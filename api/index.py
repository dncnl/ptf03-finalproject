from flask import Flask, render_template, request, jsonify
import joblib
import pandas as pd
import numpy as np
import os

# Configure Flask for Vercel serverless compatibility
app = Flask(
    __name__,
    template_folder='../templates',
    static_folder='../static',
    static_url_path='/static'
)

# Load all 4 model bundles
models_dir = os.path.join(os.path.dirname(__file__), '..', 'models')

bundles = {}
for name in ['random_forest', 'xgboost', 'gmm', 'dbscan']:
    path = os.path.join(models_dir, f'{name}.joblib')
    try:
        bundles[name] = joblib.load(path)
        print(f'Loaded {name}: {list(bundles[name].keys())}')
    except FileNotFoundError:
        print(f'Warning: Model file not found: {path}')
        bundles[name] = None
    except Exception as e:
        print(f'Warning: Failed to load {name}: {str(e)}')
        bundles[name] = None

SUPERVISED = ['random_forest', 'xgboost']
UNSUPERVISED = ['gmm', 'dbscan']

# Features the form sends (subset of training features)
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
        if bundle is None:
            return jsonify({'success': False, 'error': f'Model {model_name} is not available. Models must be deployed separately.'}), 503
        raw_features = {field: data.get(field, '') for field in FORM_FIELDS}
        X = encode_input(raw_features, bundle)

        if model_name in SUPERVISED:
            return jsonify(predict_supervised(model_name, bundle, X))
        else:
            return jsonify(predict_unsupervised(model_name, bundle, X))

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


def predict_supervised(model_name, bundle, X):
    model = bundle['model']
    prediction = model.predict(X)[0]
    proba = model.predict_proba(X)[0]
    churn_prob = float(proba[1])

    return {
        'success': True,
        'model_type': 'supervised',
        'model': model_name,
        'prediction': 'Churn' if prediction == 1 else 'No Churn',
        'probability': round(churn_prob, 4),
        'confidence': f'{churn_prob * 100:.1f}%'
    }


def predict_unsupervised(model_name, bundle, X):
    model = bundle['model']
    scaler = bundle['scaler']
    profiles = bundle['cluster_profiles']

    X_scaled = scaler.transform(X)

    if model_name == 'gmm':
        cluster_id = int(model.predict(X_scaled)[0])
    elif model_name == 'dbscan':
        pca = bundle['pca']
        X_pca = pca.transform(X_scaled)
        # DBSCAN can't predict new points — find nearest core sample
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


if __name__ == '__main__':
    app.run(debug=True)
