import cv2
import base64
import json
import numpy as np

# Load real face 1
img1 = cv2.imread(r'C:\Users\tiwar\.gemini\antigravity-ide\brain\a6aee473-a857-4fa3-b869-1b0769cd6da2\.user_uploaded\media_1791356838301.png')
crop1 = img1[320:780, 50:480]
_, buf1 = cv2.imencode('.jpg', crop1)
face1_b64 = 'data:image/jpeg;base64,' + base64.b64encode(buf1).decode('utf-8')

# Face B (different biometric features, triggers FACE_MISMATCH)
crop_diff = crop1.copy()
crop_diff[220:440, :] = cv2.bitwise_not(crop_diff[220:440, :])
_, buf2 = cv2.imencode('.jpg', crop_diff)
face2_b64 = 'data:image/jpeg;base64,' + base64.b64encode(buf2).decode('utf-8')

# Multi face (two faces side-by-side)
double = np.hstack([crop1, crop1])
_, buf_multi = cv2.imencode('.jpg', double, [int(cv2.IMWRITE_JPEG_QUALITY), 100])
multi_face_b64 = 'data:image/jpeg;base64,' + base64.b64encode(buf_multi).decode('utf-8')

# Blurry face
blur = cv2.GaussianBlur(crop1, (45, 45), 0)
_, buf_blur = cv2.imencode('.jpg', blur)
blur_b64 = 'data:image/jpeg;base64,' + base64.b64encode(buf_blur).decode('utf-8')

# Blank image (no face, high sharpness so it's not rejected as blurry)
# A grid of sharp geometric shapes with NO face
no_face = np.ones((250, 250, 3), dtype=np.uint8) * 200
for i in range(0, 250, 20):
    cv2.line(no_face, (i, 0), (i, 250), (40, 40, 40), 2)
    cv2.line(no_face, (0, i), (250, i), (40, 40, 40), 2)
_, buf_noface = cv2.imencode('.jpg', no_face)
noface_b64 = 'data:image/jpeg;base64,' + base64.b64encode(buf_noface).decode('utf-8')

data = {
    'faceA': face1_b64,
    'faceB': face2_b64,
    'multiFace': multi_face_b64,
    'blurryFace': blur_b64,
    'noFace': noface_b64,
}

with open(r'backend/scripts/test_faces.json', 'w', encoding='utf-8') as f:
    json.dump(data, f)

print('Generated test_faces.json successfully.')
