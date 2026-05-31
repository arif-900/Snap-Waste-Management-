import io
import random
from PIL import Image
from typing import Dict, Any, Optional
from app.config import settings

# Try to import YOLO from ultralytics
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False

class YoloService:
    def __init__(self):
        self.model = None
        self._is_initialized = False

    def _initialize_model(self):
        if self._is_initialized:
            return
            
        if not YOLO_AVAILABLE:
            print("WARNING: ultralytics package not found. Running YOLO in MOCK mode.")
            self._is_initialized = True
            return
            
        try:
            model_path = settings.YOLO_MODEL_PATH
            print(f"Initializing YOLO model from: {model_path}...")
            # Load the model (downloads automatically if it's a standard model and not present)
            self.model = YOLO(model_path)
            self._is_initialized = True
            print("YOLO model initialized successfully.")
        except Exception as e:
            print(f"WARNING: Failed to load YOLO model: {e}. Running YOLO in MOCK mode.")
            self._is_initialized = True

    def analyze_waste_image(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Runs YOLO model inference on the uploaded image.
        
        Returns:
            Dict: Keys include is_waste, waste_type, severity, confidence, and description.
        """
        self._initialize_model()
        
        if not self.model:
            return self._generate_mock_analysis(image_bytes)
            
        try:
            # Read image bytes using Pillow
            image = Image.open(io.BytesIO(image_bytes))
            
            # Execute inference on CPU (verbose=False to keep logs clean)
            results = self.model.predict(image, verbose=False)
            
            if not results or len(results) == 0:
                return self._generate_mock_analysis(image_bytes)
                
            result = results[0]
            boxes = result.boxes
            
            if len(boxes) == 0:
                return {
                    "is_waste": False,
                    "show_bypass": True,
                    "waste_type": "Other",
                    "severity": "Low",
                    "confidence": 1.0,
                    "description": "YOLO analyzed the scene and detected no prominent waste objects."
                }
                
            detected_classes = []
            confidences = []
            counts = {}
            class_names = result.names
            
            for box in boxes:
                class_id = int(box.cls[0].item())
                conf = float(box.conf[0].item())
                class_name = class_names.get(class_id, "object").lower()
                
                detected_classes.append(class_name)
                confidences.append(conf)
                counts[class_name] = counts.get(class_name, 0) + 1
                
            total_detected = len(detected_classes)
            avg_confidence = sum(confidences) / total_detected if confidences else 0.85
            
            # Define specific COCO classes that are considered garbage or waste
            waste_classes = {
                # Plastic / Bottles / Glass / Cans
                "bottle", "cup", "wine glass", "bowl", "can", "bucket", "box",
                # Organic / Food waste
                "banana", "apple", "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake",
                # E-waste
                "laptop", "mouse", "keyboard", "cell phone", "tv", "microwave", "oven", "toaster", "refrigerator",
                # Large debris / Illegal dumping
                "chair", "couch", "bed", "dining table", "toilet", "suitcase",
                # Custom/Generic waste terms
                "plastic", "glass", "metal", "paper", "cardboard", "trash", "garbage", "litter", "waste"
            }
            
            # Check if any detected item belongs to waste_classes
            waste_detected = [cls for cls in detected_classes if cls in waste_classes]
            
            if not waste_detected:
                # Detections occurred but none are waste items (e.g. only person, car, dog detected)
                items_summary = ", ".join([f"{count} {name}{'s' if count > 1 else ''}" for name, count in counts.items()])
                return {
                    "is_waste": False,
                    "show_bypass": False,
                    "waste_type": "Other",
                    "severity": "Low",
                    "confidence": round(avg_confidence, 2),
                    "description": f"YOLO detected no waste. (Found non-waste items: {items_summary})"
                }
            
            # Map detected categories to system waste types
            plastic_classes = {"bottle", "cup", "wine glass", "bowl", "box", "can", "bucket"}
            organic_classes = {"banana", "apple", "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake"}
            ewaste_classes = {"laptop", "mouse", "keyboard", "cell phone", "tv", "microwave", "oven", "toaster", "refrigerator"}
            large_debris_classes = {"chair", "couch", "bed", "dining table", "toilet", "suitcase"}
            
            num_plastic = sum(counts.get(cls, 0) for cls in plastic_classes)
            num_organic = sum(counts.get(cls, 0) for cls in organic_classes)
            num_ewaste = sum(counts.get(cls, 0) for cls in ewaste_classes)
            num_large = sum(counts.get(cls, 0) for cls in large_debris_classes)
            
            # Default waste categorization logic
            primary_class = max(counts, key=counts.get)
            
            if "plastic" in primary_class or "glass" in primary_class or "metal" in primary_class or "paper" in primary_class or "cardboard" in primary_class:
                waste_type = "Plastic Waste"
            elif "organic" in primary_class or "food" in primary_class or "bio" in primary_class:
                waste_type = "Other"
            elif "trash" in primary_class or "garbage" in primary_class or "litter" in primary_class:
                waste_type = "Illegal Dumping" if total_detected > 3 else "Other"
            elif num_plastic > 0 and num_plastic >= max(num_organic, num_ewaste, num_large):
                waste_type = "Plastic Waste"
            elif num_large > 0 and num_large >= max(num_plastic, num_organic, num_ewaste):
                waste_type = "Illegal Dumping"
            elif num_ewaste > 0 and num_ewaste >= max(num_plastic, num_organic, num_large):
                waste_type = "E-Waste"
            elif total_detected >= 5:
                waste_type = "Overflowing Garbage Bin"
            else:
                waste_type = "Other"
                
            # Determine Severity by counting items
            if total_detected <= 2:
                severity = "Low"
            elif total_detected <= 5:
                severity = "Medium"
            else:
                severity = "High"
                
            # Construct a descriptive label summarizing counts
            items_summary = ", ".join([f"{count} {name}{'s' if count > 1 else ''}" for name, count in counts.items()])
            description = f"[YOLOv8] Detected {items_summary} in the scene."
            if len(description) > 150:
                description = description[:147] + "..."
                
            return {
                "is_waste": True,
                "show_bypass": True,
                "waste_type": waste_type,
                "severity": severity,
                "confidence": round(avg_confidence, 2),
                "description": description
            }
            
        except Exception as e:
            print(f"Error during YOLO inference: {e}. Defaulting to mock analysis.")
            return self._generate_mock_analysis(image_bytes)

    def _generate_mock_analysis(self, image_bytes: Optional[bytes] = None) -> Dict[str, Any]:
        """Generates mock YOLO analysis when package is not configured or fails."""
        import hashlib
        
        r = random.Random()
        if image_bytes:
            hasher = hashlib.md5(image_bytes)
            seed = int(hasher.hexdigest(), 16)
            r.seed(seed)
            
        mock_detections = [
            {"counts": {"bottle": 3, "cup": 2}, "type": "Plastic Waste", "severity": "Medium", "desc": "3 bottles, 2 cups"},
            {"counts": {"chair": 2, "suitcase": 1}, "type": "Illegal Dumping", "severity": "High", "desc": "2 chairs, 1 suitcase"},
            {"counts": {"cell phone": 1, "laptop": 1}, "type": "E-Waste", "severity": "Medium", "desc": "1 cell phone, 1 laptop"},
            {"counts": {"banana": 2, "apple": 1, "orange": 1}, "type": "Other", "severity": "Low", "desc": "2 bananas, 1 apple, 1 orange"},
            {"counts": {"bottle": 6, "cup": 4, "bowl": 2}, "type": "Overflowing Garbage Bin", "severity": "High", "desc": "6 bottles, 4 cups, 2 bowls"}
        ]
        
        selection = r.choice(mock_detections)
        avg_conf = round(r.uniform(0.78, 0.94), 2)
        
        return {
            "is_waste": True,
            "show_bypass": True,
            "waste_type": selection["type"],
            "severity": selection["severity"],
            "confidence": avg_conf,
            "description": f"[Mock YOLOv8] Detected {selection['desc']}."
        }

# Singleton instance
yolo_service = YoloService()
