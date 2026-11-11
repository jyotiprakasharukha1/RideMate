
const { MongoClient } = require("mongodb");

let client;
let db;
let connectionPromise;

const connectDB = async () => {
  if (db) return db;

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      const uri = process.env.MONGODB_URI;

      if (!uri) {
        throw new Error("MONGODB_URI is missing from environment variables");
      }

      client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        maxPoolSize: 10,
        retryWrites: true
      });

      await client.connect();

      db = client.db("RideMate");

      console.log("MongoDB Atlas connected successfully!");

      return db;
    } catch (error) {
      console.error("MongoDB connection failed:", error.message);

      if (client) {
        await client.close().catch(() => {});
      }

      client = null;
      db = null;

      throw error;
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
};

const getDB = () => {
  if (!db) {
    throw new Error("Database is not connected");
  }

  return db;
};

const getClient = () => {
  if (!client) {
    throw new Error("MongoDB client is not connected");
  }

  return client;
};

const closeDB = async () => {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log("MongoDB connection closed.");
  }
};

module.exports = {
  connectDB,
  getDB,
  getClient,
  closeDB
};
