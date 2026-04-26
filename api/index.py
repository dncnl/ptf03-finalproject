from flask import Flask, render_template, request, jsonify
import random

app = Flask(__name__, template_folder='../templates', static_folder='../static')

@app.route('/')
def index():
    """Serve the main dashboard"""
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    """Mock prediction endpoint"""
    try:
        data = request.get_json()
        
        # Extract features from the request
        tenure = float(data.get('tenure', 0))
        monthly_charges = float(data.get('MonthlyCharges', 0))
        contract = data.get('Contract', '')
        internet_service = data.get('InternetService', '')
        
        # Mock prediction logic
        # Randomly decide between Churn and No Churn
        churn_probability = 0.85
        prediction = random.choice(['Churn', 'No Churn'])
        
        # Return the result
        return jsonify({
            'success': True,
            'prediction': prediction,
            'probability': churn_probability,
            'confidence': f"{churn_probability * 100:.1f}%"
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

if __name__ == '__main__':
    app.run(debug=True)
