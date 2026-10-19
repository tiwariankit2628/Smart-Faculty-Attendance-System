/**
 * Temporary Testing Geofence Switcher
 * Sets active attendance zone to Railway Community Hall, Jodhpur for development testing.
 */
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/geo_faculty_attendance';

const JODHPUR_TEST_ZONE = {
  name: 'Railway Community Hall, Jodhpur (Testing Zone)',
  latitude: 26.2830,
  longitude: 73.0220,
  radiusMeters: 5000, // 5 km buffer covering city neighborhood for indoor/Wi-Fi testing
  maxAllowedAccuracyMeters: 1000, // accommodate laptop Wi-Fi positioning (150m-500m)
  isActive: true,
};

async function setTestLocation() {
  console.log('Connecting to MongoDB at:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  const collection = mongoose.connection.collection('attendancezones');

  // Deactivate any existing active zones
  await collection.updateMany({ isActive: true }, { $set: { isActive: false } });

  // Check if testing zone already exists
  const existingTestZone = await collection.findOne({ name: JODHPUR_TEST_ZONE.name });
  if (existingTestZone) {
    await collection.updateOne(
      { _id: existingTestZone._id },
      { $set: { ...JODHPUR_TEST_ZONE, updatedAt: new Date() } }
    );
    console.log(' Updated existing Jodhpur test zone to active:');
  } else {
    await collection.insertOne({
      ...JODHPUR_TEST_ZONE,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(' Created and activated new Jodhpur test zone:');
  }

  const activeZone = await collection.findOne({ isActive: true });
  console.log(JSON.stringify(activeZone, null, 2));

  await mongoose.disconnect();
  console.log(' Attendance geofence successfully switched to Railway Community Hall, Jodhpur.');
}

setTestLocation().catch((err) => {
  console.error('Failed to set test location:', err);
  process.exit(1);
});
