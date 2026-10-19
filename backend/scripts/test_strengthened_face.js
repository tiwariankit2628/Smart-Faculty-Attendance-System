const fs = require('fs');
const path = require('path');

async function testStrengthenedFace() {
  console.log('=================================================================');
  console.log('   VERIFYING STRENGTHENED FACULTY IDENTITY FACE VERIFICATION     ');
  console.log('=================================================================\n');

  // Load prepared test image fixtures
  const faces = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'test_faces.json'), 'utf8')
  );

  // 1. Login as Faculty A (Dr. Amit Sharma: faculty@lpu.in / LPU-FAC-101)
  const loginResA = await fetch('http://127.0.0.1:5000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'faculty@lpu.in', password: 'FacultyPassword@123' }),
  });
  const cookieA = loginResA.headers.get('set-cookie');
  const userA = (await loginResA.json()).data.user;
  console.log(`1. Logged in as Faculty A: ${userA.name} (${userA.employeeId})`);

  // Ensure Faculty A has faceA enrolled
  await fetch('http://127.0.0.1:5000/api/v1/faculty/face-registration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ image: faces.faceA }),
  });

  // TEST 1: No Face Detected
  console.log('\n2. Testing NO FACE condition:');
  const noFaceRes = await fetch('http://127.0.0.1:5000/api/v1/attendance/verify-face', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ image: faces.noFace }),
  });
  const noFaceJson = await noFaceRes.json();
  console.log(`   HTTP ${noFaceRes.status} | Code: ${noFaceJson.error?.code}`);
  console.log(`   Message: "${noFaceJson.error?.message}"`);
  if (
    noFaceRes.status === 400 &&
    noFaceJson.error?.message === 'No face detected. Please position your face clearly in the camera.'
  ) {
    console.log('   ✓ Expected "No face detected" validation message confirmed!');
  } else {
    console.error('   ✗ Unexpected no face message:', noFaceJson);
    process.exit(1);
  }

  // TEST 2: Multiple Faces Detected
  console.log('\n3. Testing MULTIPLE FACES condition:');
  const multiFaceRes = await fetch('http://127.0.0.1:5000/api/v1/attendance/verify-face', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ image: faces.multiFace }),
  });
  const multiFaceJson = await multiFaceRes.json();
  console.log(`   HTTP ${multiFaceRes.status} | Code: ${multiFaceJson.error?.code}`);
  console.log(`   Message: "${multiFaceJson.error?.message}"`);
  if (
    multiFaceRes.status === 400 &&
    multiFaceJson.error?.message === 'Multiple faces detected. Please ensure only one person is visible.'
  ) {
    console.log('   ✓ Expected "Multiple faces detected" message confirmed!');
  } else {
    console.error('   ✗ Unexpected multiple faces message:', multiFaceJson);
    process.exit(1);
  }

  // TEST 3: Poor Quality / Blurry Face
  console.log('\n4. Testing POOR QUALITY / BLURRY FACE condition:');
  const blurRes = await fetch('http://127.0.0.1:5000/api/v1/attendance/verify-face', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ image: faces.blurryFace }),
  });
  const blurJson = await blurRes.json();
  console.log(`   HTTP ${blurRes.status} | Code: ${blurJson.error?.code}`);
  console.log(`   Message: "${blurJson.error?.message}"`);
  if (
    blurRes.status === 400 &&
    blurJson.error?.message === 'Face image is not clear enough. Please improve lighting and try again.'
  ) {
    console.log('   ✓ Expected "Poor quality" message confirmed!');
  } else {
    console.error('   ✗ Unexpected quality message:', blurJson);
    process.exit(1);
  }

  // TEST 4: Wrong Person / Cross-Faculty Impersonation
  // Logged in as Faculty A, but presenting Faculty B's face!
  console.log('\n5. Testing WRONG PERSON (Faculty B face presented for Faculty A):');
  const wrongPersonRes = await fetch('http://127.0.0.1:5000/api/v1/attendance/verify-face', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ image: faces.faceB }),
  });
  const wrongPersonJson = await wrongPersonRes.json();
  console.log(`   HTTP ${wrongPersonRes.status} | Code: ${wrongPersonJson.error?.code}`);
  console.log(`   Message: "${wrongPersonJson.error?.message}"`);
  if (
    wrongPersonRes.status === 400 &&
    wrongPersonJson.error?.message ===
      'Face verification failed. The detected face does not match your registered faculty profile.'
  ) {
    console.log('   ✓ Impersonation strictly blocked! Expected "Wrong person" error message returned!');
  } else {
    console.error('   ✗ Unexpected wrong person result:', wrongPersonJson);
    process.exit(1);
  }

  // TEST 5: Successful Verification for Genuine Faculty A
  console.log('\n6. Testing SUCCESSFUL IDENTITY VERIFICATION (Faculty A face):');
  const successRes = await fetch('http://127.0.0.1:5000/api/v1/attendance/verify-face', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ image: faces.faceA }),
  });
  const successJson = await successRes.json();
  console.log(`   HTTP ${successRes.status} | Success: ${successJson.success}`);
  console.log(`   Message: "${successJson.data?.message}"`);
  console.log(`   Confidence: ${successJson.data?.faceConfidence}`);
  console.log(`   Face Token: ${successJson.data?.faceToken}`);
  if (
    successRes.status === 200 &&
    successJson.data?.faceVerified === true &&
    successJson.data?.message === 'Identity verified successfully.' &&
    successJson.data?.faceToken?.startsWith('face_')
  ) {
    console.log('   ✓ Genuine identity verified successfully with token!');
  } else {
    console.error('   ✗ Unexpected success response:', successJson);
    process.exit(1);
  }
  const faceToken = successJson.data.faceToken;

  // TEST 6: Attendance Submission Multi-Gate Verification
  console.log('\n7. Testing Attendance Submission Multi-Gate Enforcement:');
  const locRes = await fetch('http://127.0.0.1:5000/api/v1/attendance/verify-location', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ latitude: 26.2830, longitude: 73.0220, accuracy: 15 }),
  });
  const locJson = await locRes.json();
  const locationToken = locJson.data?.locationToken;
  console.log(`   Location Token acquired: ${locationToken?.slice(0, 16)}...`);

  // Gate 2 failure test: Mark without faceToken -> Must fail with 400
  const noFaceMarkRes = await fetch('http://127.0.0.1:5000/api/v1/attendance/mark', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({
      latitude: 26.2830,
      longitude: 73.0220,
      accuracy: 15,
      locationToken,
    }),
  });
  console.log(`   Gate Check: Mark without faceToken -> HTTP ${noFaceMarkRes.status} (Strictly rejected with 400)`);
  if (noFaceMarkRes.status !== 400) {
    console.error('   ✗ Failed to reject attendance without faceToken');
    process.exit(1);
  }

  // Gate 1 failure test: Mark without locationToken -> Must fail with 400
  const noLocMarkRes = await fetch('http://127.0.0.1:5000/api/v1/attendance/mark', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({
      latitude: 26.2830,
      longitude: 73.0220,
      accuracy: 15,
      faceToken,
    }),
  });
  console.log(`   Gate Check: Mark without locationToken -> HTTP ${noLocMarkRes.status} (Strictly rejected with 400)`);
  if (noLocMarkRes.status !== 400) {
    console.error('   ✗ Failed to reject attendance without locationToken');
    process.exit(1);
  }

  console.log('\n=================================================================');
  console.log(' ALL 5 SPECIFIED ERROR/SUCCESS MESSAGES & MULTI-GATE ENFORCEMENT');
  console.log('           VERIFIED WITH 100% SUCCESS RATE!                      ');
  console.log('=================================================================');
}

testStrengthenedFace().catch((err) => {
  console.error(err);
  process.exit(1);
});
