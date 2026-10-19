const { execSync } = require('child_process');

async function runE2E() {
  console.log('--- 1. Faculty Login ---');
  const loginRes = await fetch('http://127.0.0.1:5000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'faculty@lpu.in', password: 'FacultyPassword@123' })
  });
  const cookie = loginRes.headers.get('set-cookie');
  console.log('Login status:', loginRes.status);

  // Extract base64 of real user face crop
  const userPhotoB64 = execSync(
    'python -c "import cv2, base64; img = cv2.imread(r\'C:\\Users\\tiwar\\.gemini\\antigravity-ide\\brain\\a6aee473-a857-4fa3-b869-1b0769cd6da2\\.user_uploaded\\media_1791356838301.png\'); crop = img[320:780, 50:480]; _, buf = cv2.imencode(\'.jpg\', crop); print(\'data:image/jpeg;base64,\' + base64.b64encode(buf).decode())"',
    { encoding: 'utf8' }
  ).trim();

  // Create a blank image (no face)
  const blankPhotoB64 = execSync(
    'python -c "import cv2, base64, numpy as np; img = np.ones((200, 200, 3), dtype=np.uint8) * 120; _, buf = cv2.imencode(\'.jpg\', img); print(\'data:image/jpeg;base64,\' + base64.b64encode(buf).decode())"',
    { encoding: 'utf8' }
  ).trim();

  // Helper to obtain a fresh liveness challenge token
  async function getChallenge() {
    const res = await fetch('http://127.0.0.1:5000/api/v1/attendance/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie }
    });
    const data = await res.json();
    return data.data?.challengeToken;
  }

  // TEST 1: No Face Detected
  console.log('\n--- 2. TEST: No Face Image ---');
  const noFaceToken = await getChallenge();
  const noFaceRes = await fetch('http://127.0.0.1:5000/api/v1/attendance/verify-face', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ image: blankPhotoB64, challengeToken: noFaceToken })
  });
  const noFaceData = await noFaceRes.json();
  console.log('No Face status:', noFaceRes.status);
  console.log('No Face response:', JSON.stringify(noFaceData, null, 2));

  // TEST 2: Register User Photo as Official Faculty Face Profile
  console.log('\n--- 3. TEST: Register Faculty Face Profile ---');
  const regRes = await fetch('http://127.0.0.1:5000/api/v1/faculty/face-registration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ image: userPhotoB64 })
  });
  const regData = await regRes.json();
  console.log('Registration status:', regRes.status);
  console.log('Registration response:', JSON.stringify(regData, null, 2));

  // TEST 3: Verify with Matching Real Face Photo
  console.log('\n--- 4. TEST: Verify with Registered Face Photo ---');
  const matchToken = await getChallenge();
  const matchRes = await fetch('http://127.0.0.1:5000/api/v1/attendance/verify-face', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ image: userPhotoB64, challengeToken: matchToken })
  });
  const matchData = await matchRes.json();
  console.log('Match status:', matchRes.status);
  console.log('Match response:', JSON.stringify(matchData, null, 2));

  // TEST 4: Create a different face (imposter / different person)
  const diffPhotoB64 = execSync(
    'python -c "import cv2, base64; img = cv2.imread(r\'C:\\Users\\tiwar\\.gemini\\antigravity-ide\\brain\\a6aee473-a857-4fa3-b869-1b0769cd6da2\\.user_uploaded\\media_1791350832809.jpg\'); _, buf = cv2.imencode(\'.jpg\', img); print(\'data:image/jpeg;base64,\' + base64.b64encode(buf).decode())"',
    { encoding: 'utf8' }
  ).trim();

  // TEST 5: Verify with Face Mismatch (different facial biometrics)
  console.log('\n--- 6. TEST: Face Mismatch (Different Face Geometry) ---');
  const mismatchPhotoB64 = execSync(
    'python -c "import cv2, base64; img = cv2.imread(r\'C:\\Users\\tiwar\\.gemini\\antigravity-ide\\brain\\a6aee473-a857-4fa3-b869-1b0769cd6da2\\.user_uploaded\\media_1791356838301.png\'); crop = img[320:780, 50:480].copy(); crop[220:440, :] = cv2.bitwise_not(crop[220:440, :]); _, buf = cv2.imencode(\'.jpg\', crop); print(\'data:image/jpeg;base64,\' + base64.b64encode(buf).decode())"',
    { encoding: 'utf8' }
  ).trim();

  const mismatchToken = await getChallenge();
  const mismatchRes = await fetch('http://127.0.0.1:5000/api/v1/attendance/verify-face', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ image: mismatchPhotoB64, challengeToken: mismatchToken })
  });
  const mismatchData = await mismatchRes.json();
  console.log('Mismatch status:', mismatchRes.status);
  console.log('Mismatch response:', JSON.stringify(mismatchData, null, 2));
}

runE2E().catch(console.error);
