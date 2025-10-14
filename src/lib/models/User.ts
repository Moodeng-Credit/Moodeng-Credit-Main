import mongoose, { Schema } from 'mongoose';

import { type IUser, WorldId } from '@/types/authTypes';

const UserSchema = new Schema<IUser>({
   walletAddress: { type: String, unique: true, required: true },
   username: { type: String, unique: true, required: true },
   isWorldId: { type: String, enum: Object.values(WorldId), required: true },
   nullifierHash: { type: String, index: { unique: true, sparse: true } },
   password: { type: String, required: true },
   email: { type: String, unique: true, required: true },
   telegramUsername: { type: String, index: { unique: true, sparse: true } },
   chatId: { type: Number, index: { unique: true, sparse: true } },
   mal: { type: Number, max: 3, default: 1 },
   nal: { type: Number, max: 3, default: 0 },
   cs: { type: Number, default: 15 },
   createdAt: { type: Date, default: Date.now },
   updatedAt: { type: Date, default: Date.now }
});

// Handle index recreation on model initialization
UserSchema.statics.ensureIndexes = async function () {
   try {
      // Get current indexes
      const indexes = await this.collection.indexes();

      // Check if indexes exist and are configured correctly
      const chatIdIndex = indexes.find((i) => i.key?.chatId === 1);
      const telegramIndex = indexes.find((i) => i.key?.telegramUsername === 1);

      const needsUpdate =
         (chatIdIndex && !chatIdIndex.sparse) || (telegramIndex && !telegramIndex.sparse) || !chatIdIndex || !telegramIndex;

      if (needsUpdate) {
         console.log('Index update needed:', {
            chatIdExists: !!chatIdIndex,
            chatIdSparse: chatIdIndex?.sparse,
            telegramExists: !!telegramIndex,
            telegramSparse: telegramIndex?.sparse
         });

         // Drop existing indexes if they exist
         if (chatIdIndex) await this.collection.dropIndex('chatId_1');
         if (telegramIndex) await this.collection.dropIndex('telegramUsername_1');

         // Create new indexes with correct settings
         const chatIdResult = await this.collection.createIndex({ chatId: 1 }, { unique: true, sparse: true, name: 'chatId_2' });
         const telegramResult = await this.collection.createIndex(
            { telegramUsername: 1 },
            { unique: true, sparse: true, name: 'telegramUsername_2' }
         );

         console.log('Indexes updated successfully:', {
            chatIdIndex: chatIdResult,
            telegramIndex: telegramResult
         });
      } else {
         console.log('Indexes are already correctly configured');
      }
   } catch (error: unknown) {
      console.error('Error managing indexes:', error);
   }
};

const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

// Indexes will be managed after database connection is established

export default User;
