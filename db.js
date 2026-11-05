// MongoDB connection (connects only one time and re-uses it)
const { MongoClient } = require("mongodb");

let client;
let db;

async function connectDB() {
  if (db) return db;
  client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db(process.env.DB_NAME || "studiospace");
  console.log("MongoDB connected");
  return db;
}

function getDB() {
  if (!db) throw new Error("Database is not connected yet");
  return db;
}

module.exports = { connectDB, getDB };
