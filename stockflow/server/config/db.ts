import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { env } from './env';

let memoryServer: MongoMemoryServer | null = null;
let isConnected = false;

export async function connectDatabase(): Promise<{ mode: 'external' | 'memory'; uri: string }> {
  if (isConnected && mongoose.connection.readyState === 1) {
    return {
      mode: memoryServer ? 'memory' : 'external',
      uri: env.MONGODB_URI || memoryServer?.getUri() || '',
    };
  }

  mongoose.set('strictQuery', true);

  if (env.MONGODB_URI && !env.MONGODB_URI.includes('<username>')) {
    await mongoose.connect(env.MONGODB_URI);
    isConnected = true;
    console.log('[StockFlow DB] Connected to external MongoDB');
    return { mode: 'external', uri: env.MONGODB_URI };
  }

  // Fallback to in-process MongoDB for zero-config local & sandbox execution
  memoryServer = await MongoMemoryServer.create({
    instance: {
      dbName: 'stockflow',
    },
  });
  const uri = memoryServer.getUri('stockflow');
  await mongoose.connect(uri);
  isConnected = true;
  console.log(`[StockFlow DB] Connected to local MongoDB instance at ${uri}`);
  return { mode: 'memory', uri };
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
  isConnected = false;
}
