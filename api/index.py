from flask import Flask, render_template, request, jsonify
import random
import os

# Configure Flask with absolute paths for Vercel serverless compatibility
app = Flask(
    __name__,
    template_folder=os.path.abspath(os.path.join(os.path.dirname(__file__), '../templates')),
    static_folder=os.path.abspath(os.path.join(os.path.dirname(__file__), '../static')),
    static_url_path='/static'
)

@app.route('/')
def index():
    """Serve the main dashboard"""
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    """Prediction endpoint with input validation and model selection"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No JSON data provided'
            }), 400
        
        # Extract and validate features
        try:
            tenure = float(data.get('tenure', 0))
            monthly_charges = float(data.get('MonthlyCharges', 0))
        except (ValueError, TypeError):
            return jsonify({
                'success': False,
                'error': 'Tenure and Monthly Charges must be valid numbers'
            }), 400
        
        contract = data.get('Contract', '').strip()
        internet_service = data.get('InternetService', '').strip()
        model_name = data.get('model', 'random_forest').strip()
        
        # Validate tenure range
        if tenure < 0 or tenure > 72:
            return jsonify({
                'success': False,
                'error': 'Tenure must be between 0 and 72 months'
            }), 400
        
        # Validate monthly charges
        if monthly_charges < 0:
            return jsonify({
                'success': False,
                'error': 'Monthly Charges must be greater than or equal to 0'
            }), 400
        
        # Validate contract type
        valid_contracts = ['Month-to-month', 'One year', 'Two year']
        if contract not in valid_contracts:
            return jsonify({
                'success': False,
                'error': f'Contract must be one of: {", ".join(valid_contracts)}'
            }), 400
        
        # Validate internet service
        valid_services = ['DSL', 'Fiber optic', 'No']
        if internet_service not in valid_services:
            return jsonify({
                'success': False,
                'error': f'Internet Service must be one of: {", ".join(valid_services)}'
            }), 400
        
        # Validate model selection
        valid_models = ['random_forest', 'xgboost', 'gmm', 'dbscan']
        if model_name not in valid_models:
            return jsonify({
                'success': False,
                'error': f'Model must be one of: {", ".join(valid_models)}'
            }), 400
        
        # NOTE: Mock predictions - replace with actual ML model calls
        # TODO: Load pre-trained models from disk and call model.predict()
        churn_probability = 0.85
        prediction = random.choice(['Churn', 'No Churn'])
        
        # Return the result
        return jsonify({
            'success': True,
            'prediction': prediction,
            'probability': churn_probability,
            'confidence': f"{churn_probability * 100:.1f}%",
            'model': model_name
        })
    
    except Exception as e:
        print(f"Error in /predict: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500

if __name__ == '__main__':
    app.run(debug=True)
