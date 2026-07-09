const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI not found");
  process.exit(1);
}

async function run() {
  await mongoose.connect(uri);
  console.log("Connected to MongoDB.");
  
  const CommandSchema = new mongoose.Schema({}, { strict: false });
  const Command = mongoose.model('Command', CommandSchema, 'commands');
  
  const result = await Command.updateMany(
    { status: { $in: ['CREATED', 'QUEUED', 'PUBLISHED', 'RECEIVED', 'EXECUTING'] } },
    { $set: { status: 'FAILED', result: { success: false, reason: 'Manual queue reset for testing' } } }
  );
  
  console.log(`Updated ${result.modifiedCount} commands to FAILED.`);
  await mongoose.disconnect();
}

run().catch(console.error);
