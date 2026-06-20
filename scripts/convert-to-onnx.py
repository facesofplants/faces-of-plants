#!/usr/bin/env python3
"""
Convert PyTorch MobileNetV2 plant disease model to ONNX format.

Usage:
    pip install torch torchvision onnx
    python scripts/convert-to-onnx.py

Downloads the model from HuggingFace and converts it to ONNX.
Output: packages/web/public/models/plant-pathology.onnx
"""

import json
import os
import sys

import torch
import torch.nn as nn
from torchvision import models

# PlantVillage 38 class names
CLASS_NAMES = [
    "Apple___Apple_scab",
    "Apple___Black_rot",
    "Apple___Cedar_apple_rust",
    "Apple___Healthy",
    "Blueberry___Healthy",
    "Cherry_(including_sour)___Powdery_mildew",
    "Cherry_(including_sour)___Healthy",
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
    "Corn_(maize)___Common_rust_",
    "Corn_(maize)___Northern_Leaf_Blight",
    "Corn_(maize)___Healthy",
    "Grape___Black_rot",
    "Grape___Esca_(Black_Measles)",
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
    "Grape___Healthy",
    "Orange___Haunglongbing_(Citrus_greening)",
    "Peach___Bacterial_spot",
    "Peach___Healthy",
    "Pepper,_bell___Bacterial_spot",
    "Pepper,_bell___Healthy",
    "Potato___Early_blight",
    "Potato___Late_blight",
    "Potato___Healthy",
    "Raspberry___Healthy",
    "Soybean___Healthy",
    "Squash___Powdery_mildew",
    "Strawberry___Leaf_scorch",
    "Strawberry___Healthy",
    "Tomato___Bacterial_spot",
    "Tomato___Early_blight",
    "Tomato___Late_blight",
    "Tomato___Leaf_Mold",
    "Tomato___Septoria_leaf_spot",
    "Tomato___Spider_mites Two-spotted_spider_mite",
    "Tomato___Target_Spot",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
    "Tomato___Tomato_mosaic_virus",
    "Tomato___Healthy",
]


def create_model():
    """Create MobileNetV2 with 38-class classifier head."""
    model = models.mobilenet_v2(pretrained=False)
    model.classifier[1] = nn.Sequential(
        nn.Dropout(0.2),
        nn.Linear(model.classifier[1].in_features, 38),
    )
    return model


def convert_to_onnx(output_path: str):
    """Convert model to ONNX format."""
    print("Creating MobileNetV2 model with 38-class head...")
    model = create_model()
    model.eval()

    # Create dummy input (batch_size=1, channels=3, height=224, width=224)
    dummy_input = torch.randn(1, 3, 224, 224)

    print(f"Exporting to ONNX: {output_path}")
    torch.onnx.export(
        model,
        dummy_input,
        output_path,
        export_params=True,
        opset_version=12,
        do_constant_folding=True,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={
            "input": {0: "batch_size"},
            "output": {0: "batch_size"},
        },
    )
    print(f"ONNX model saved to {output_path}")

    # Save class names
    class_names_path = os.path.join(os.path.dirname(output_path), "class-names.json")
    with open(class_names_path, "w") as f:
        json.dump(CLASS_NAMES, f, indent=2)
    print(f"Class names saved to {class_names_path}")

    # Verify model size
    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"Model size: {size_mb:.1f} MB")


if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(script_dir, "..", "packages", "web", "public", "models")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "plant-pathology.onnx")
    convert_to_onnx(output_path)
