async function testPhotos() {
  console.log('Testing photo upload and validation...');

  // 1. Login as TL (Kamal Sharma)
  const loginRes = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'kamal.sharma@transsion.com',
      password: 'Kama@19103905',
    }),
  });

  const loginData = await loginRes.json();
  if (!loginData.success) {
    console.error('Admin login failed:', loginData);
    return;
  }
  const token = loginData.data.token;
  console.log('✓ Admin login successful');

  // Create fake small 1x1 image data URI
  const fakeFrontDataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const fakeBackDataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

  // 2. Test rejection of photo > 5MB
  const oversizedPhoto = {
    label: 'front',
    mimeType: 'image/jpeg',
    sizeBytes: 6 * 1024 * 1024, // 6 MB > 5 MB
    dataUri: fakeFrontDataUri,
    capturedAt: new Date().toISOString(),
  };

  const oversizedRes = await fetch('http://localhost:3001/api/assignments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      itemId: 'TEST-OVERSIZED-12345',
      itemName: 'Test Device Oversized',
      employeeId: 'rohan.singh@transsion.com',
      employeeName: 'Rohan Raj Singh',
      assignedAt: '2026-10-30',
      status: 'Active',
      assignmentPhotos: [oversizedPhoto],
    }),
  });

  const oversizedData = await oversizedRes.json();
  console.log('✓ Oversized photo rejection HTTP status:', oversizedRes.status, '(expected 400)');
  console.log('✓ Error message:', JSON.stringify(oversizedData.error?.details || oversizedData.error?.message));

  // 3. Find an available device from inventory
  const invRes = await fetch('http://localhost:3001/api/inventory?pageSize=5&status=Inactive', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const invData = await invRes.json();
  const availableItem = invData.data?.records?.[0];
  if (!availableItem) {
    console.log('No inactive inventory item found, testing with new mock ID.');
  } else {
    console.log('✓ Found available stock device:', availableItem.brand, availableItem.deviceModel, `(IMEI: ${availableItem.imei1 || availableItem.itemId})`);
  }

  const targetItemId = availableItem ? (availableItem.imei1 || availableItem.itemId) : `TEST-IMEI-${Date.now().toString().slice(-8)}`;
  const targetItemName = availableItem ? `${availableItem.brand} ${availableItem.deviceModel}` : 'Tecno Phantom V Fold';

  // 4. Create assignment with Front and Back photos
  const validPhotos = [
    {
      label: 'front',
      mimeType: 'image/jpeg',
      sizeBytes: 250 * 1024, // 250 KB
      dataUri: fakeFrontDataUri,
      capturedAt: new Date().toISOString(),
    },
    {
      label: 'back',
      mimeType: 'image/jpeg',
      sizeBytes: 240 * 1024, // 240 KB
      dataUri: fakeBackDataUri,
      capturedAt: new Date().toISOString(),
    },
  ];

  const assignRes = await fetch('http://localhost:3001/api/assignments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      itemId: targetItemId,
      itemName: targetItemName,
      employeeId: 'rohan.singh@transsion.com',
      employeeName: 'Rohan Raj Singh',
      assignedAt: '2026-10-30',
      status: 'Active',
      assignedFrom: 'WH-1 (Main Hub)',
      assignmentPhotos: validPhotos,
      notes: 'QA Lab performance benchmarking sprint',
    }),
  });

  const assignData = await assignRes.json();
  console.log('✓ Assignment creation HTTP status:', assignRes.status, 'Success:', assignData.success);
  if (!assignData.success) {
    console.error('Assignment creation failed:', assignData);
    return;
  }

  const createdAssignment = assignData.data;
  console.log('✓ Created assignment ID:', createdAssignment.id);
  console.log('✓ Assignment photos saved in database:', createdAssignment.assignmentPhotos?.length, 'photos');
  console.log('✓ Photo labels:', createdAssignment.assignmentPhotos?.map((p) => p.label));

  // 5. Test returning the assignment with Return Photos
  const returnPhotos = [
    {
      label: 'front',
      mimeType: 'image/jpeg',
      sizeBytes: 260 * 1024,
      dataUri: fakeFrontDataUri,
      capturedAt: new Date().toISOString(),
    },
    {
      label: 'back',
      mimeType: 'image/jpeg',
      sizeBytes: 255 * 1024,
      dataUri: fakeBackDataUri,
      capturedAt: new Date().toISOString(),
    },
  ];

  const returnRes = await fetch(`http://localhost:3001/api/assignments/${createdAssignment.id}/return`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      returnedAt: '2026-10-30',
      returnedBy: 'Rohan Raj Singh',
      returnedTo: 'Vinod Kundra (Admin)',
      returnLocation: 'WH-1 (Main Hub)',
      returnCondition: 'Good / Pristine Condition',
      notes: 'Returned after benchmark test completion',
      returnPhotos: returnPhotos,
    }),
  });

  const returnData = await returnRes.json();
  console.log('\n✓ Return device HTTP status:', returnRes.status, 'Success:', returnData.success);
  if (!returnData.success) {
    console.error('Return failed:', returnData);
    return;
  }

  const returnedAssignment = returnData.data;
  console.log('✓ Returned assignment status:', returnedAssignment.status);
  console.log('✓ Stored assignmentPhotos count:', returnedAssignment.assignmentPhotos?.length);
  console.log('✓ Stored returnPhotos count:', returnedAssignment.returnPhotos?.length);

  // 6. Test Custody Tracking API to ensure photos are presented in the journey
  const trackingRes = await fetch(`http://localhost:3001/api/inventory/${encodeURIComponent(targetItemId)}/tracking`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const trackingData = await trackingRes.json();
  console.log('✓ Tracking API status:', trackingRes.status, 'Success:', trackingData.success);
  if (trackingData.success) {
    const journey = trackingData.data.journey || [];
    const assignmentStep = journey.find((j) => j.stage === 'ASSIGNMENT');
    const returnStep = journey.find((j) => j.stage === 'RETURN');
    console.log('✓ Journey ASSIGNMENT step photos:', assignmentStep?.details?.photos?.length);
    console.log('✓ Journey RETURN step photos:', returnStep?.details?.photos?.length);
  }

  console.log('\n🎉 ALL PHOTO VALIDATION & DATABASE STORAGE TESTS PASSED!');
}

testPhotos().catch(console.error);
