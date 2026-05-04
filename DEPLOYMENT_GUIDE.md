# Model Deployment Guide

Your Churn Prediction dashboard is deployed on Vercel, but the machine learning models need to be stored separately. This guide explains why and how to set it up.

## Why Models Are Excluded

1. **Bundle Size**: ML models (joblib files) are typically 1-5 MB each
2. **Vercel Limit**: Lambda functions have a 500 MB limit
3. **Your Setup**: ~2.2 MB of models alone, which can push you over the limit with dependencies

## Option 1: AWS S3 (Recommended for Production)

### Step 1: Create S3 Bucket
```bash
# Via AWS Console:
1. Go to AWS S3
2. Create bucket: "your-company-churn-models"
3. Upload your 4 .joblib files
```

### Step 2: Update Python Code

Add to `api/index.py`:

```python
import boto3
import io

# Load models from S3 instead of local
def load_models_from_s3():
    s3 = boto3.client('s3')
    bucket_name = os.getenv('S3_BUCKET_NAME')
    
    bundles = {}
    for name in ['random_forest', 'xgboost', 'gmm', 'dbscan']:
        try:
            obj = s3.get_object(Bucket=bucket_name, Key=f'{name}.joblib')
            bundles[name] = joblib.load(io.BytesIO(obj['Body'].read()))
            print(f'✓ Loaded {name} from S3')
        except Exception as e:
            print(f'⚠ Failed to load {name} from S3: {str(e)}')
            bundles[name] = None
    
    return bundles
```

### Step 3: Update requirements.txt

```bash
flask
gunicorn
joblib
pandas
numpy
scikit-learn
boto3  # Add this for AWS S3
```

### Step 4: Add Environment Variables to Vercel

```bash
# In Vercel dashboard:
1. Settings > Environment Variables
2. Add:
   - AWS_ACCESS_KEY_ID: your_key
   - AWS_SECRET_ACCESS_KEY: your_secret
   - S3_BUCKET_NAME: your-company-churn-models
```

---

## Option 2: Google Cloud Storage

### Step 1: Create GCS Bucket
```bash
gsutil mb gs://your-company-churn-models
gsutil cp models/*.joblib gs://your-company-churn-models/
```

### Step 2: Update Python Code

```python
from google.cloud import storage
import io

def load_models_from_gcs():
    client = storage.Client()
    bucket = client.bucket(os.getenv('GCS_BUCKET_NAME'))
    
    bundles = {}
    for name in ['random_forest', 'xgboost', 'gmm', 'dbscan']:
        try:
            blob = bucket.blob(f'{name}.joblib')
            bundles[name] = joblib.load(io.BytesIO(blob.download_as_bytes()))
            print(f'✓ Loaded {name} from GCS')
        except Exception as e:
            print(f'⚠ Failed to load {name}: {str(e)}')
            bundles[name] = None
    
    return bundles
```

### Step 3: Update requirements.txt

```bash
flask
gunicorn
joblib
pandas
numpy
scikit-learn
google-cloud-storage  # Add this for GCS
```

---

## Option 3: Local Testing (Development Only)

For testing locally during development, models are automatically loaded from the `models/` directory.

```bash
# Install dependencies
pip install -r requirements.txt

# Run Flask locally
python api/index.py

# Flask will load models from ./models/ directory
```

**Note**: The `.vercelignore` file excludes the `models/` directory from Vercel deployment, so this only works locally.

---

## Option 4: Azure Blob Storage

Similar process to S3 or GCS:

```python
from azure.storage.blob import BlobClient
import io

def load_models_from_azure():
    connection_string = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
    
    bundles = {}
    for name in ['random_forest', 'xgboost', 'gmm', 'dbscan']:
        try:
            blob = BlobClient.from_connection_string(
                connection_string, 
                container_name="models",
                blob_name=f'{name}.joblib'
            )
            bundles[name] = joblib.load(io.BytesIO(blob.download_blob().readall()))
            print(f'✓ Loaded {name} from Azure')
        except Exception as e:
            print(f'⚠ Failed to load {name}: {str(e)}')
            bundles[name] = None
    
    return bundles
```

---

## Quick Checklist

For your Vercel deployment to work with models:

- [ ] Choose a cloud storage solution (S3, GCS, or Azure)
- [ ] Upload your 4 .joblib files to cloud storage
- [ ] Add API credentials to Vercel environment variables
- [ ] Update `api/index.py` to load from cloud storage
- [ ] Test locally first before deploying
- [ ] Update `requirements.txt` with cloud SDK
- [ ] Deploy to Vercel: `git push`

---

## Testing the Setup

```bash
# Locally - should work automatically
curl -X POST http://localhost:5000/predict \
  -H "Content-Type: application/json" \
  -d '{"tenure":12, "MonthlyCharges":79.99, "Contract":"Month-to-month", "InternetService":"Fiber optic", "model":"random_forest"}'

# On Vercel - will work after uploading models to cloud storage
# Test via the web dashboard
```

---

## Troubleshooting

**Error: "Model random_forest is not available"**
- Check: Are model files in cloud storage?
- Check: Are environment variables set in Vercel?
- Check: Do API credentials have proper permissions?

**"Access Denied" from cloud storage**
- Verify IAM/permissions for the service account
- Check API keys are correct
- Ensure bucket/container is accessible

**Models load slowly**
- This is normal on first request (cold start)
- Consider using models in memory cache or Redis for faster loads

---

## Cost Estimates

| Provider | Storage | Data Transfer | Estimated Monthly Cost |
|----------|---------|---|---|
| AWS S3 | $0.023/GB | $0.09/GB | < $1 |
| Google Cloud | $0.020/GB | $0.12/GB | < $1 |
| Azure Blob | $0.018/GB | $0.087/GB | < $1 |

**All providers offer free tiers suitable for this project.**

---

For questions or issues, check the provider documentation:
- [AWS S3 Python SDK](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/s3.html)
- [Google Cloud Storage Python](https://cloud.google.com/python/docs/reference/storage/latest)
- [Azure Blob Storage Python](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-quickstart-blobs-python)
