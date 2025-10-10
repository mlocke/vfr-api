#!/usr/bin/env python3
"""
Register Sentiment-Fusion Model in Production Registry

Registers a trained sentiment-fusion model version for production use.
Validates model files, creates registry entry, and updates active model pointer.

Usage:
    python3 scripts/ml/register-sentiment-fusion-model.py --version v1.1.0
"""

import json
import os
import argparse
from datetime import datetime
from pathlib import Path


def validate_model_files(model_dir):
    """Validate that all required model files exist"""
    required_files = {
        'model.txt': 'LightGBM model file',
        'normalizer.json': 'Feature normalization parameters',
        'metadata.json': 'Training metadata',
        'test_evaluation.json': 'Test set evaluation results',
        'feature_importance.csv': 'Feature importance rankings'
    }

    missing_files = []
    for filename, description in required_files.items():
        filepath = os.path.join(model_dir, filename)
        if not os.path.exists(filepath):
            missing_files.append(f"{filename} ({description})")

    return missing_files


def load_model_metadata(model_dir):
    """Load model metadata from JSON file"""
    metadata_file = os.path.join(model_dir, 'metadata.json')
    with open(metadata_file, 'r') as f:
        metadata = json.load(f)
    return metadata


def load_test_evaluation(model_dir):
    """Load test evaluation results from JSON file"""
    eval_file = os.path.join(model_dir, 'test_evaluation.json')
    with open(eval_file, 'r') as f:
        evaluation = json.load(f)
    return evaluation


def create_registry_entry(version, model_dir, metadata, evaluation):
    """Create model registry entry"""
    entry = {
        'model_version': version,
        'model_type': 'sentiment-fusion',
        'algorithm': 'LightGBM',
        'model_path': str(model_dir),
        'registered_at': datetime.now().isoformat(),
        'training_info': {
            'training_date': metadata['training_date'],
            'training_examples': metadata['training_examples'],
            'validation_examples': metadata['validation_examples'],
            'num_features': metadata['num_features'],
            'feature_categories': metadata['feature_categories']
        },
        'performance': {
            'validation_accuracy': metadata['performance']['validation_accuracy'],
            'test_accuracy': evaluation['accuracy'],
            'test_examples': evaluation['test_examples'],
            'baseline_random': evaluation['baseline_random'],
            'baseline_majority': evaluation['baseline_majority'],
            'improvement_over_random': evaluation['improvement_over_random'],
            'improvement_over_v1_0': evaluation.get('improvement_over_v1_0'),
            'macro_roc_auc': evaluation.get('macro_roc_auc'),
            'per_class_metrics': evaluation['per_class_metrics']
        },
        'deployment_status': 'registered',
        'is_active': False  # Will be set to True after approval
    }

    return entry


def update_model_registry(registry_path, entry):
    """Update model registry with new entry"""
    # Load existing registry or create new one
    if os.path.exists(registry_path):
        with open(registry_path, 'r') as f:
            registry = json.load(f)
    else:
        registry = {
            'models': [],
            'active_model': None,
            'last_updated': None
        }

    # Check if version already exists
    existing_versions = [m['model_version'] for m in registry['models']]
    if entry['model_version'] in existing_versions:
        print(f"⚠️  Warning: Version {entry['model_version']} already registered")
        print(f"   Replacing existing entry...")
        registry['models'] = [m for m in registry['models'] if m['model_version'] != entry['model_version']]

    # Add new entry
    registry['models'].append(entry)
    registry['last_updated'] = datetime.now().isoformat()

    # Save updated registry
    with open(registry_path, 'w') as f:
        json.dump(registry, f, indent=2)

    return registry


def activate_model(registry_path, version):
    """Set model as active in production"""
    with open(registry_path, 'r') as f:
        registry = json.load(f)

    # Deactivate all models
    for model in registry['models']:
        model['is_active'] = False

    # Activate selected version
    for model in registry['models']:
        if model['model_version'] == version:
            model['is_active'] = True
            model['deployment_status'] = 'active'
            model['activated_at'] = datetime.now().isoformat()
            break

    # Update active model pointer
    registry['active_model'] = version
    registry['last_updated'] = datetime.now().isoformat()

    # Save updated registry
    with open(registry_path, 'w') as f:
        json.dump(registry, f, indent=2)

    print(f"✅ Model {version} activated for production")
    return registry


def print_model_summary(entry):
    """Print model registration summary"""
    print("\n" + "=" * 80)
    print("MODEL REGISTRATION SUMMARY")
    print("=" * 80)
    print()
    print(f"📦 Model Version: {entry['model_version']}")
    print(f"🏷️  Model Type: {entry['model_type']}")
    print(f"🤖 Algorithm: {entry['algorithm']}")
    print(f"📁 Model Path: {entry['model_path']}")
    print()
    print(f"📊 Training Information:")
    print(f"   Training Date: {entry['training_info']['training_date']}")
    print(f"   Training Examples: {entry['training_info']['training_examples']:,}")
    print(f"   Validation Examples: {entry['training_info']['validation_examples']:,}")
    print(f"   Features: {entry['training_info']['num_features']}")
    print()
    print(f"🎯 Performance Metrics:")
    print(f"   Validation Accuracy: {entry['performance']['validation_accuracy']:.4f} ({entry['performance']['validation_accuracy']*100:.2f}%)")
    print(f"   Test Accuracy: {entry['performance']['test_accuracy']:.4f} ({entry['performance']['test_accuracy']*100:.2f}%)")
    print(f"   Test Examples: {entry['performance']['test_examples']:,}")
    print(f"   Macro ROC AUC: {entry['performance']['macro_roc_auc']:.4f}")
    print()
    print(f"📈 Baseline Comparisons:")
    print(f"   Random Baseline: {entry['performance']['baseline_random']:.4f} ({entry['performance']['baseline_random']*100:.2f}%)")
    print(f"   Majority Baseline: {entry['performance']['baseline_majority']:.4f} ({entry['performance']['baseline_majority']*100:.2f}%)")
    print(f"   Improvement over Random: +{entry['performance']['improvement_over_random']*100:.2f} percentage points")
    if entry['performance']['improvement_over_v1_0']:
        print(f"   Improvement over v1.0.0: +{entry['performance']['improvement_over_v1_0']*100:.2f} percentage points")
    print()
    print(f"📋 Per-Class Performance:")
    for label, metrics in entry['performance']['per_class_metrics'].items():
        print(f"   {label:8s}: Precision {metrics['precision']:.4f}, Recall {metrics['recall']:.4f}, F1 {metrics['f1_score']:.4f}")
    print()
    print(f"🚀 Deployment Status: {entry['deployment_status']}")
    print(f"🔌 Active: {'Yes' if entry['is_active'] else 'No'}")
    print()


def register_sentiment_fusion_model(version, activate=False):
    """Main registration function"""

    print("=" * 80)
    print("REGISTER SENTIMENT-FUSION MODEL")
    print("=" * 80)
    print()

    # Validate version format
    if not version.startswith('v'):
        print(f"❌ Error: Version must start with 'v' (e.g., v1.1.0)")
        return False

    # Define paths
    model_dir = f"models/sentiment-fusion/{version}"
    registry_path = "models/sentiment-fusion/model-registry.json"

    # Validate model directory exists
    if not os.path.exists(model_dir):
        print(f"❌ Error: Model directory not found: {model_dir}")
        return False

    print(f"📂 Model Directory: {model_dir}")
    print()

    # Validate required files
    print("🔍 Validating model files...")
    missing_files = validate_model_files(model_dir)

    if missing_files:
        print(f"❌ Error: Missing required files:")
        for missing in missing_files:
            print(f"   - {missing}")
        return False

    print("   ✓ All required files present")
    print()

    # Load metadata and evaluation
    print("📖 Loading model metadata...")
    try:
        metadata = load_model_metadata(model_dir)
        evaluation = load_test_evaluation(model_dir)
        print("   ✓ Metadata loaded successfully")
        print()
    except Exception as e:
        print(f"❌ Error loading metadata: {e}")
        return False

    # Create registry entry
    print("📝 Creating registry entry...")
    entry = create_registry_entry(version, model_dir, metadata, evaluation)
    print("   ✓ Registry entry created")
    print()

    # Update model registry
    print("💾 Updating model registry...")
    try:
        registry = update_model_registry(registry_path, entry)
        print(f"   ✓ Registry updated: {registry_path}")
        print()
    except Exception as e:
        print(f"❌ Error updating registry: {e}")
        return False

    # Print summary
    print_model_summary(entry)

    # Activate model if requested
    if activate:
        print("🚀 Activating model for production...")
        try:
            activate_model(registry_path, version)
            print()
        except Exception as e:
            print(f"❌ Error activating model: {e}")
            return False
    else:
        print("ℹ️  Note: Model registered but not activated. Use --activate flag to deploy.")
        print()

    print("=" * 80)
    print("✅ REGISTRATION COMPLETE")
    print("=" * 80)
    print()

    if not activate:
        print("Next Steps:")
        print(f"   1. Review model performance metrics above")
        print(f"   2. Activate model: python3 scripts/ml/activate-sentiment-fusion-model.py --version {version}")
        print(f"   3. Test predictions with production endpoints")
        print()

    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description='Register sentiment-fusion model in production registry'
    )
    parser.add_argument(
        '--version',
        type=str,
        required=True,
        help='Model version to register (e.g., v1.1.0)'
    )
    parser.add_argument(
        '--activate',
        action='store_true',
        help='Activate model for production after registration'
    )

    args = parser.parse_args()

    success = register_sentiment_fusion_model(args.version, activate=args.activate)

    exit(0 if success else 1)
