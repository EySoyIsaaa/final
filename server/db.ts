import { MongoClient, Db, Collection } from 'mongodb';
import { ENV } from './_core/env';

let _client: MongoClient | null = null;
let _db: Db | null = null;

export interface User {
  _id?: string;
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
}

// Lazily create the MongoDB connection
export async function getDb(): Promise<Db | null> {
  if (!_db && process.env.MONGO_URL) {
    try {
      const dbName = process.env.DB_NAME;
      if (!dbName) {
        console.warn('[Database] DB_NAME environment variable not set');
        return null;
      }
      _client = new MongoClient(process.env.MONGO_URL);
      await _client.connect();
      _db = _client.db(dbName);
      console.log('[Database] Connected to MongoDB');
    } catch (error) {
      console.warn('[Database] Failed to connect:', error);
      _db = null;
    }
  }
  return _db;
}

export async function getUsersCollection(): Promise<Collection<User> | null> {
  const db = await getDb();
  if (!db) return null;
  return db.collection<User>('users');
}

export async function upsertUser(user: Partial<User> & { openId: string }): Promise<void> {
  if (!user.openId) {
    throw new Error('User openId is required for upsert');
  }

  const users = await getUsersCollection();
  if (!users) {
    console.warn('[Database] Cannot upsert user: database not available');
    return;
  }

  try {
    const now = new Date();
    const updateDoc: Partial<User> = {
      updatedAt: now,
      lastSignedIn: user.lastSignedIn || now,
    };

    if (user.name !== undefined) updateDoc.name = user.name;
    if (user.email !== undefined) updateDoc.email = user.email;
    if (user.loginMethod !== undefined) updateDoc.loginMethod = user.loginMethod;
    
    // Set role
    if (user.role !== undefined) {
      updateDoc.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      updateDoc.role = 'admin';
    }

    await users.updateOne(
      { openId: user.openId },
      {
        $set: updateDoc,
        $setOnInsert: {
          openId: user.openId,
          role: updateDoc.role || 'user',
          createdAt: now,
        },
      },
      { upsert: true }
    );
  } catch (error) {
    console.error('[Database] Failed to upsert user:', error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const users = await getUsersCollection();
  if (!users) {
    console.warn('[Database] Cannot get user: database not available');
    return undefined;
  }

  const user = await users.findOne({ openId });
  return user || undefined;
}

// Cleanup function for graceful shutdown
export async function closeDb(): Promise<void> {
  if (_client) {
    await _client.close();
    _client = null;
    _db = null;
  }
}
