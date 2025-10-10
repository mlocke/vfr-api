#!/usr/bin/env python3
"""
Sentiment Fusion - FinBERT Prediction Server
Loads FinBERT model once and handles multiple predictions via stdin/stdout
"""

import sys
import json
import argparse
import os
from pathlib import Path

try:
    import torch
    from transformers import AutoTokenizer, AutoModelForSequenceClassification
    import numpy as np
except ImportError as e:
    sys.stderr.write(f'ERROR: Missing required package: {e}\n')
    sys.stderr.write('Install: pip install torch transformers numpy\n')
    sys.stderr.flush()
    sys.exit(1)

class FinBERTPredictionServer:
    def __init__(self, model_dir: str):
        """Initialize server and load FinBERT model"""
        self.model = None
        self.tokenizer = None
        self.model_dir = model_dir
        self.max_length = 512
        self.label_map = {0: 'BEARISH', 1: 'NEUTRAL', 2: 'BULLISH'}
        self._load_model()

    def _load_model(self):
        """Load FinBERT model and tokenizer (once)"""
        try:
            # Check if fine-tuned model exists
            model_path = Path(self.model_dir)

            # Check for both pytorch_model.bin and model.safetensors formats
            has_pytorch_model = (model_path / 'pytorch_model.bin').exists()
            has_safetensors = (model_path / 'model.safetensors').exists()

            if model_path.exists() and (has_pytorch_model or has_safetensors):
                # Load fine-tuned model
                model_format = 'pytorch_model.bin' if has_pytorch_model else 'model.safetensors'
                sys.stderr.write(f'Loading fine-tuned FinBERT from {self.model_dir} ({model_format})\n')
                self.model = AutoModelForSequenceClassification.from_pretrained(
                    self.model_dir,
                    num_labels=3,
                    local_files_only=True
                )
                self.tokenizer = AutoTokenizer.from_pretrained(
                    self.model_dir,
                    local_files_only=True
                )
            else:
                # Fallback to base pretrained FinBERT
                sys.stderr.write('Fine-tuned model not found, loading base ProsusAI/finbert\n')
                model_name = 'ProsusAI/finbert'
                self.model = AutoModelForSequenceClassification.from_pretrained(
                    model_name,
                    num_labels=3
                )
                self.tokenizer = AutoTokenizer.from_pretrained(model_name)

            # Set to evaluation mode
            self.model.eval()

            # Use GPU if available
            self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
            self.model.to(self.device)

            sys.stderr.write(f'Device: {self.device}\n')
            sys.stderr.write('READY\n')
            sys.stderr.flush()
        except Exception as e:
            sys.stderr.write(f'ERROR: {str(e)}\n')
            sys.stderr.flush()
            sys.exit(1)

    def predict(self, text: str) -> dict:
        """Make prediction on text input"""
        if not text or len(text.strip()) == 0:
            raise ValueError('Text input cannot be empty')

        # Tokenize text (max 512 tokens)
        inputs = self.tokenizer(
            text,
            max_length=self.max_length,
            padding='max_length',
            truncation=True,
            return_tensors='pt'
        )

        # Move to device
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        # Run inference
        with torch.no_grad():
            outputs = self.model(**inputs)
            logits = outputs.logits

            # Apply softmax to get probabilities
            probs = torch.nn.functional.softmax(logits, dim=-1)
            probs_np = probs.cpu().numpy()[0]

            # Get prediction (class with highest probability)
            predicted_class = int(np.argmax(probs_np))
            prediction = self.label_map[predicted_class]

            # Calculate confidence (max probability)
            confidence = float(np.max(probs_np))

            # Extract individual probabilities
            probability = {
                'bearish': float(probs_np[0]),
                'neutral': float(probs_np[1]),
                'bullish': float(probs_np[2])
            }

        return {
            'prediction': prediction,
            'confidence': confidence,
            'probability': probability
        }

    def run(self):
        """Run prediction server loop"""
        for line in sys.stdin:
            try:
                # Parse request
                request = json.loads(line.strip())
                text = request.get('text')

                if not text:
                    response = {
                        'success': False,
                        'error': 'Missing required field: text'
                    }
                else:
                    # Make prediction
                    result = self.predict(text)
                    response = {
                        'success': True,
                        'data': result
                    }

                # Send response
                print(json.dumps(response), flush=True)

            except Exception as e:
                response = {
                    'success': False,
                    'error': str(e)
                }
                print(json.dumps(response), flush=True)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='FinBERT Prediction Server')
    parser.add_argument(
        '--model-dir',
        type=str,
        required=True,
        help='Path to fine-tuned model directory (or fallback to base FinBERT)'
    )
    args = parser.parse_args()

    server = FinBERTPredictionServer(model_dir=args.model_dir)
    server.run()
