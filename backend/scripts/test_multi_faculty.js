const BASE_URL = 'http://localhost:5000/api/v1';

async function run() {
  console.log('--- Multi-Faculty Authentication Live E2E Verification ---\n');

  // 1. Register a new faculty account
  const timestamp = Date.now().toString().slice(-4);
  const newFaculty = {
    name: 'Prof. Sneha Reddy',
    email: `sneha.reddy.${timestamp}@lpu.in`,
    employeeId: `LPU-FAC-${timestamp}`,
    department: 'Department of Biotechnology',
    password: 'InitialPassword@123',
  };

  console.log(`1. Testing Faculty Sign Up: ${newFaculty.email} (${newFaculty.employeeId})...`);
  const regRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newFaculty),
  });
  const regData = await regRes.json();
  if (regRes.status !== 201 || !regData.success) {
    console.error('Registration failed:', regData);
    process.exit(1);
  }
  console.log(`   ✓ Registered successfully! User ID: ${regData.data.user.id}, Role: ${regData.data.user.role}`);
  const regCookie = regRes.headers.get('set-cookie');

  // 2. Test duplicate email rejection
  console.log('\n2. Testing duplicate email rejection...');
  const dupEmailRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Another Faculty',
      email: newFaculty.email,
      employeeId: `LPU-FAC-DIFF-${timestamp}`,
      department: 'SCSE',
      password: 'Password@123',
    }),
  });
  const dupEmailData = await dupEmailRes.json();
  if (dupEmailRes.status === 409 && dupEmailData.error?.code === 'EMAIL_ALREADY_EXISTS') {
    console.log(`   ✓ Duplicate email properly rejected with 409 (${dupEmailData.error.message})`);
  } else {
    console.error('   ✗ Expected 409 for duplicate email, got:', dupEmailRes.status, dupEmailData);
    process.exit(1);
  }

  // 3. Test duplicate employee ID rejection
  console.log('\n3. Testing duplicate faculty ID rejection...');
  const dupEmpRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Another Faculty',
      email: `diff.${timestamp}@lpu.in`,
      employeeId: newFaculty.employeeId,
      department: 'SCSE',
      password: 'Password@123',
    }),
  });
  const dupEmpData = await dupEmpRes.json();
  if (dupEmpRes.status === 409 && dupEmpData.error?.code === 'FACULTY_ID_ALREADY_EXISTS') {
    console.log(`   ✓ Duplicate faculty ID properly rejected with 409 (${dupEmpData.error.message})`);
  } else {
    console.error('   ✗ Expected 409 for duplicate employeeId, got:', dupEmpRes.status, dupEmpData);
    process.exit(1);
  }

  // 4. Test Forgot Password
  console.log('\n4. Testing Forgot Password code generation...');
  const forgotRes = await fetch(`${BASE_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: newFaculty.email }),
  });
  const forgotData = await forgotRes.json();
  if (forgotRes.status === 200 && forgotData.data.resetToken) {
    console.log(`   ✓ Reset code received: ${forgotData.data.resetToken}`);
  } else {
    console.error('   ✗ Forgot password failed:', forgotData);
    process.exit(1);
  }
  const resetCode = forgotData.data.resetToken;

  // 5. Test Reset Password
  const newPassword = 'NewSecretPassword@456';
  console.log('\n5. Testing Reset Password with code...');
  const resetRes = await fetch(`${BASE_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: newFaculty.email,
      resetToken: resetCode,
      newPassword,
    }),
  });
  const resetData = await resetRes.json();
  if (resetRes.status === 200) {
    console.log(`   ✓ ${resetData.data.message}`);
  } else {
    console.error('   ✗ Password reset failed:', resetData);
    process.exit(1);
  }

  // 6. Test Login with new password
  console.log('\n6. Testing Login with new password...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: newFaculty.email,
      password: newPassword,
    }),
  });
  const loginData = await loginRes.json();
  if (loginRes.status === 200 && loginData.data.user.employeeId === newFaculty.employeeId) {
    console.log(`   ✓ Logged in as ${loginData.data.user.name} (${loginData.data.user.employeeId})`);
  } else {
    console.error('   ✗ Login failed:', loginData);
    process.exit(1);
  }
  const snehaCookie = loginRes.headers.get('set-cookie');

  // 7. Verify session belongs to Sneha
  console.log('\n7. Verifying /auth/me for Prof. Sneha Reddy...');
  const meRes = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Cookie: snehaCookie },
  });
  const meData = await meRes.json();
  if (meData.data.user.email === newFaculty.email.toLowerCase()) {
    console.log(`   ✓ Active session verified for ${meData.data.user.name} (${meData.data.user.email})`);
  } else {
    console.error('   ✗ Session user mismatch:', meData);
    process.exit(1);
  }

  // 8. Test Login as seeded Faculty 2 (Dr. Priya Patel)
  console.log('\n8. Testing Login as Dr. Priya Patel (priya.patel@lpu.in)...');
  const priyaLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'priya.patel@lpu.in',
      password: 'FacultyPassword@123',
    }),
  });
  const priyaLoginData = await priyaLoginRes.json();
  if (priyaLoginRes.status === 200) {
    console.log(`   ✓ Logged in as ${priyaLoginData.data.user.name} (${priyaLoginData.data.user.employeeId})`);
    console.log(`     Department: ${priyaLoginData.data.user.department}`);
  } else {
    console.error('   ✗ Login as Priya Patel failed:', priyaLoginData);
    process.exit(1);
  }
  const priyaCookie = priyaLoginRes.headers.get('set-cookie');

  // 9. Verify session belongs to Priya, not Sneha or Amit
  console.log('\n9. Verifying /auth/me for Dr. Priya Patel...');
  const priyaMeRes = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Cookie: priyaCookie },
  });
  const priyaMeData = await priyaMeRes.json();
  if (priyaMeData.data.user.employeeId === 'LPU-FAC-102') {
    console.log(`   ✓ Independent session confirmed for ${priyaMeData.data.user.name} (${priyaMeData.data.user.employeeId})`);
  } else {
    console.error('   ✗ Session user mismatch for Priya:', priyaMeData);
    process.exit(1);
  }

  // 10. Verify Geofence verification works for any faculty member
  console.log('\n10. Testing Geofence Location Verification for Dr. Priya Patel...');
  const geoRes = await fetch(`${BASE_URL}/attendance/verify-location`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: priyaCookie,
    },
    body: JSON.stringify({
      latitude: 26.2830,
      longitude: 73.0220,
      accuracy: 25,
    }),
  });
  const geoData = await geoRes.json();
  if (geoRes.status === 200 && geoData.data.locationVerified) {
    console.log(`   ✓ Location verified: ${geoData.data.zoneName}, Distance: ${Math.round(geoData.data.distanceFromZone)}m`);
    console.log(`   ✓ Location token issued: ${geoData.data.locationToken}`);
  } else {
    console.error('   ✗ Geofence verification failed:', geoData);
    process.exit(1);
  }

  console.log('\n======================================================');
  console.log(' ALL MULTI-FACULTY AUTHENTICATION TESTS PASSED 100%!');
  console.log('======================================================');
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
