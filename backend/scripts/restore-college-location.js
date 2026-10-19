/**
 * College Location Restoration Script
 * Restores the original Lovely Professional University (LPU) geofence configuration.
 */
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/geo_faculty_attendance';

const LPU_CAMPUS_ZONE = {
  name: 'Lovely Professional University (LPU) - Main Campus',
  latitude: 31.2536,
  longitude: 75.7037,
  radiusMeters: 500,
  maxAllowedAccuracyMeters: 35,
  isActive: true,
};

async function restoreCollegeLocation() {
  console.log('Connecting to MongoDB at:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  const collection = mongoose.connection.collection('attendancezones');

  // Deactivate all zones
  await collection.updateMany({ isActive: true }, { $set: { isActive: false } });

  // Check if original LPU zone exists
  const existingLpuZone = await collection.findOne({
    name: { $regex: /Lovely Professional University/i },
  });

  if (existingLpuZone) {
    await collection.updateOne(
      { _id: existingLpuZone._id },
      { $set: { ...LPU_CAMPUS_ZONE, updatedAt: new Date() } }
    );
    console.log(' Reactivated original LPU Campus zone:');
  } else {
    await collection.insertOne({
      ...LPU_CAMPUS_ZONE,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(' Created and activated original LPU Campus zone:');
  }

  const activeZone = await collection.findOne({ isActive: true });
  console.log(JSON.stringify(activeZone, null, 2));

  await mongoose.disconnect();
  console.log(' Attendance geofence successfully restored to LPU Main Campus.');
}

restoreCollegeLocation().catch((err) => {
  console.error('Failed to restore college location:', err);
  process.exit(1);
});
