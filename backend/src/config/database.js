import mongoose from "mongoose";

let replicaSetDetected = false;

export const checkReplicaSet = async () => {
  try {
    const admin = mongoose.connection.db.admin();
    const isMaster = await admin
      .command({ hello: 1 })
      .catch(() => admin.command({ isMaster: 1 }).catch(() => null));
    if (isMaster && (isMaster.setName || isMaster.hosts)) {
      replicaSetDetected = true;
      return true;
    }
    const status = await admin.command({ replSetGetStatus: 1 }).catch(() => null);
    if (status && status.ok) {
      replicaSetDetected = true;
      return true;
    }
  } catch {
    replicaSetDetected = false;
  }
  return false;
};

export const hasReplicaSet = () => replicaSetDetected;

/**
 * Executes a callback within a MongoDB transaction if a replica set is active.
 * If not, falls back to non-transactional execution with session=null and logs a warning.
 */
export const runInTransaction = async (workFn) => {
  if (replicaSetDetected) {
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await workFn(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  } else {
    console.warn(
      "[WARN] MongoDB is not running as a replica set. Falling back to non-transactional atomic operations with $gte stock guards."
    );
    return await workFn(null);
  }
};

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not configured");
    }

    await mongoose.connect(process.env.MONGO_URI);
    const isReplica = await checkReplicaSet();
    if (isReplica) {
      console.log("MongoDB connected [Replica Set mode - Multi-document transactions active]");
    } else {
      console.log("MongoDB connected [Standalone mode - Atomic $gte stock guards active]");
    }
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
};

export default connectDB;