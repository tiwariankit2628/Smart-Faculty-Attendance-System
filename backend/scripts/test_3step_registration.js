const { execSync } = require('child_process');

const BASE_URL = 'http://localhost:5000/api/v1';

async function run() {
  console.log('--- 3-Step Faculty Registration & Face Binding Verification ---\n');

  // Extract base64 of real user face crop
  const realFaceB64 = execSync(
    'python -c "import cv2, base64; img = cv2.imread(r\'C:\\Users\\tiwar\\.gemini\\antigravity-ide\\brain\\a6aee473-a857-4fa3-b869-1b0769cd6da2\\.user_uploaded\\media_1791356838301.png\'); crop = img[320:780, 50:480]; _, buf = cv2.imencode(\'.jpg\', crop); print(\'data:image/jpeg;base64,\' + base64.b64encode(buf).decode())"',
    { encoding: 'utf8' }
  ).trim();

  // Create a blank image (no face)
  const blankPhotoB64 = execSync(
    'python -c "import cv2, base64, numpy as np; img = np.ones((200, 200, 3), dtype=np.uint8) * 120; _, buf = cv2.imencode(\'.jpg\', img); print(\'data:image/jpeg;base64,\' + base64.b64encode(buf).decode())"',
    { encoding: 'utf8' }
  ).trim();

  // 1. Test Step 2 Face Pre-Check with valid face photo
  console.log('1. Testing Step 2 Face Check with clear face image...');
  const checkRes = await fetch(`${BASE_URL}/auth/check-face`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: realFaceB64 }),
  });
  const checkData = await checkRes.json();
  if (checkRes.status === 200 && checkData.data.valid) {
    console.log(`   ✓ Face check passed: "${checkData.data.message}" (Quality: ${checkData.data.qualityScore})`);
  } else {
    console.error('   ✗ Face check failed unexpectedly:', checkData);
    process.exit(1);
  }

  // 2. Test Step 2 Face Pre-Check rejection with blank/invalid image
  console.log('\n2. Testing Step 2 Face Check rejection with blank/invalid image...');
  const badCheckRes = await fetch(`${BASE_URL}/auth/check-face`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: blankPhotoB64 }),
  });
  const badCheckData = await badCheckRes.json();
  if (badCheckRes.status === 400 && !badCheckData.success) {
    console.log(`   ✓ Correctly rejected with 400: "${badCheckData.error?.message}" (${badCheckData.error?.code})`);
  } else {
    console.error('   ✗ Expected rejection for blank image, got:', badCheckRes.status, badCheckData);
    process.exit(1);
  }

  // 3. Test Step 2 & 3 Complete Registration: Creating faculty with faceImage bound
  const timestamp = Date.now().toString().slice(-4);
  const facultyPayload = {
    name: 'Prof. Vikram Rao',
    email: `vikram.rao.${timestamp}@lpu.in`,
    employeeId: `LPU-FAC-VR-${timestamp}`,
    department: 'Department of Mathematics & Computing',
    password: 'FacultyPassword@123',
    faceImage: realFaceB64,
  };

  console.log(`\n3. Testing Atomic Faculty Registration + Face Enrollment for ${facultyPayload.name}...`);
  const regRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(facultyPayload),
  });
  const regData = await regRes.json();
  if (regRes.status === 201 && regData.success) {
    const user = regData.data.user;
    console.log(`   ✓ Faculty created: ${user.name} (${user.employeeId})`);
    console.log(`   ✓ Biometric embedding reference linked: ${user.faceEmbeddingReference}`);
    console.log(`   ✓ Face enrolled flag: ${user.faceEnrolled}`);
    if (!user.faceEmbeddingReference || !user.faceEmbeddingReference.startsWith('face_emb_')) {
      console.error('   ✗ faceEmbeddingReference was not properly generated!');
      process.exit(1);
    }
  } else {
    console.error('   ✗ Registration with faceImage failed:', regData);
    process.exit(1);
  }
  const vikramCookie = regRes.headers.get('set-cookie');

  // 4. Verify that this new faculty member can now verify attendance using their registered face!
  console.log('\n4. Testing Live Biometric Attendance Face Verification for the newly enrolled account...');
  const verifyRes = await fetch(`${BASE_URL}/attendance/verify-face`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: vikramCookie,
    },
    body: JSON.stringify({
      image: realFaceB64,
    }),
  });
  const verifyData = await verifyRes.json();
  if (verifyRes.status === 200 && verifyData.data.faceVerified) {
    console.log(`   ✓ Biometric verification passed! Confidence: ${verifyData.data.faceConfidence}, Liveness: ${verifyData.data.livenessScore}`);
    console.log(`   ✓ Generated face token: ${verifyData.data.faceToken}`);
  } else {
    console.error('   ✗ Attendance verify-face failed for newly enrolled faculty:', verifyData);
    process.exit(1);
  }

  console.log('\n======================================================');
  console.log(' 3-STEP FACULTY REGISTRATION PROCESS VERIFIED 100%!');
  console.log('======================================================');
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
