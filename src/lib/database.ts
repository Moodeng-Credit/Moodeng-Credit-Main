import mongoose from 'mongoose';

declare global {
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   var mongoose: any; // This must be a `var` and not a `let / const`
}

let cached = global.mongoose;

if (!cached) {
   cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
   const MONGODB_URI = process.env.MONGO_URI;

   if (!MONGODB_URI) {
      throw new Error('Please define the MONGO_URI environment variable inside .env.local');
   }

   if (cached.conn) {
      return cached.conn;
   }

   if (!cached.promise) {
      const opts = {
         bufferCommands: false
      };

      cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
         console.log('MongoDB connected successfully...');
         return mongooseInstance;
      });
   }

   try {
      cached.conn = await cached.promise;
   } catch (e) {
      cached.promise = null;
      throw e;
   }

   return cached.conn;
}

// Initialize database connection and models on startup
async function initializeDatabase() {
   try {
      console.log('🚀 Initializing database connection...');
      await connectDB();

      // Import models to ensure they're registered and collections are created
      console.log('📦 Loading database models...');
      const User = (await import('./models/User')).default;
      await import('./models/Loan');

      // Ensure indexes after models are loaded and connection is established
      console.log('🔧 Setting up database indexes...');
      await User.ensureIndexes();
      console.log('✅ User indexes configured');

      console.log('✅ Database and collections initialized successfully');
   } catch (error) {
      console.error('❌ Failed to initialize database:', error);
      throw error;
   }
}

// Database initialization is handled by startup.ts

export default connectDB;
export { initializeDatabase };
