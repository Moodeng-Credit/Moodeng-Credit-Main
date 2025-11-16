import mongoose, { Schema } from 'mongoose';

import { type IUser, WorldId } from '@/types/authTypes';

const UserSchema = new Schema<IUser>({
   walletAddress: { type: String, unique: true, sparse: true },
   username: { type: String, unique: true, required: true },
   isWorldId: { type: String, enum: Object.values(WorldId), required: true },
   nullifierHash: { type: String, index: { unique: true, sparse: true } },
   password: { type: String, sparse: true },
   email: { type: String, unique: true, required: true },
   googleId: { type: String, unique: true, sparse: true },
   telegramId: { type: Number, index: { unique: true, sparse: true } },
   telegramUsername: { type: String, index: { unique: true, sparse: true } },
   chatId: { type: Number, index: { unique: true, sparse: true } },
   mal: { type: Number, max: 3, default: 3 },
   nal: { type: Number, max: 3, default: 0 },
   cs: { type: Number, default: 15 },
   resetToken: { type: String, sparse: true },
   resetTokenExpiry: { type: Date, sparse: true },
   createdAt: { type: Date, default: Date.now },
   updatedAt: { type: Date, default: Date.now }
});

// Handle index recreation on model initialization
UserSchema.statics.ensureIndexes = async function () {
   try {
      // Get current indexes
      const indexes = await this.collection.indexes();

      // Define all sparse unique indexes that need to be verified
      const sparseIndexes = [
         { field: 'walletAddress', name: 'walletAddress_1' },
         { field: 'googleId', name: 'googleId_1' },
         { field: 'telegramId', name: 'telegramId_1' },
         { field: 'telegramUsername', name: 'telegramUsername_1' },
         { field: 'chatId', name: 'chatId_1' },
         { field: 'nullifierHash', name: 'nullifierHash_1' }
      ];

      let needsUpdate = false;
      const indexStatus: Record<string, { exists: boolean; sparse: boolean }> = {};

      // Check each index
      for (const { field } of sparseIndexes) {
         const index = indexes.find((i) => i.key?.[field] === 1);
         indexStatus[field] = {
            exists: !!index,
            sparse: index?.sparse || false
         };

         // Need update if index doesn't exist or isn't sparse
         if (!index || !index.sparse) {
            needsUpdate = true;
         }
      }

      if (needsUpdate) {
         console.log('Index update needed:', indexStatus);

         // Recreate all sparse indexes
         for (const { field, name } of sparseIndexes) {
            const existingIndex = indexes.find((i) => i.key?.[field] === 1);

            // Drop existing index if it exists and either:
            // 1. Isn't sparse, or
            // 2. Has a different name than what we want
            if (existingIndex) {
               const needsDrop = !existingIndex.sparse || existingIndex.name !== name;

               if (needsDrop && existingIndex.name) {
                  try {
                     // Drop by the actual index name (not the desired name)
                     await this.collection.dropIndex(existingIndex.name);
                     console.log(`Dropped index: ${existingIndex.name} (field: ${field})`);
                  } catch (dropError) {
                     console.log(`Could not drop index ${existingIndex.name}, trying by field:`, dropError);
                     // Fallback: try dropping by field name
                     try {
                        await this.collection.dropIndex(field);
                        console.log(`Dropped index by field: ${field}`);
                     } catch (fallbackError) {
                        console.log(`Could not drop index for field ${field}:`, fallbackError);
                     }
                  }
               }
            }

            // Before creating sparse unique index, clean up null/undefined values
            // This prevents E11000 duplicate key errors for null values
            try {
               const updateResult = await this.collection.updateMany({ [field]: null }, { $unset: { [field]: '' } });
               if (updateResult.modifiedCount > 0) {
                  console.log(`Cleaned ${updateResult.modifiedCount} null values from ${field}`);
               }
            } catch (cleanupError) {
               console.log(`Could not clean null values from ${field}:`, cleanupError);
            }

            // Create/recreate sparse index with the desired name
            try {
               await this.collection.createIndex({ [field]: 1 }, { unique: true, sparse: true, name });
               console.log(`Created sparse index: ${name}`);
            } catch (createError: unknown) {
               // Check if it's a name conflict error
               if (
                  createError &&
                  typeof createError === 'object' &&
                  'codeName' in createError &&
                  createError.codeName === 'IndexOptionsConflict'
               ) {
                  // Index exists with different name, re-fetch indexes and drop it
                  try {
                     const currentIndexes = await this.collection.indexes();
                     const conflictingIndex = currentIndexes.find((i) => i.key?.[field] === 1);
                     if (conflictingIndex && conflictingIndex.name && conflictingIndex.name !== name) {
                        await this.collection.dropIndex(conflictingIndex.name);
                        console.log(`Dropped conflicting index: ${conflictingIndex.name}`);
                        // Retry creating the index
                        await this.collection.createIndex({ [field]: 1 }, { unique: true, sparse: true, name });
                        console.log(`Created sparse index: ${name}`);
                     } else {
                        console.log(`Index conflict for ${field} but couldn't resolve:`, createError);
                     }
                  } catch (retryError) {
                     console.log(`Error resolving index conflict for ${name}:`, retryError);
                  }
               } else {
                  console.log(`Index ${name} might already exist:`, createError);
               }
            }
         }

         console.log('All sparse indexes updated successfully');
      } else {
         console.log('All indexes are already correctly configured');
      }
   } catch (error: unknown) {
      console.error('Error managing indexes:', error);
   }
};

const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

// Indexes will be managed after database connection is established

export default User;
