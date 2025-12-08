import type { NextRequest } from 'next/server';

import { type IVerifyResponse, VerificationLevel, verifyCloudProof } from '@worldcoin/idkit';

import { createSupabaseServerClient } from '@/lib/supabase';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { WorldId } from '@/types/authTypes';
import { ERROR_CODES } from '@/types/errorCodes';
import { SUCCESS_CODES } from '@/types/successCodes';

const app_id = process.env.NEXT_PUBLIC_WORLD_ID_APP_ID;
const action = process.env.NEXT_PUBLIC_WORLD_ID_ACTION_ID;

export async function POST(request: NextRequest) {
   const proof = await request.json();

   return handleApiRequest(
      request,
      async (data, userId) => {
         if (proof.verification_level != VerificationLevel.Orb) {
            throw { code: ERROR_CODES.WORLDID_INVALID_LEVEL };
         }

         if (!app_id || !action) {
            throw { code: ERROR_CODES.WORLDID_CONFIG_MISSING, status: 500 };
         }

         // Verify the proof with World ID
         const verifyRes = (await verifyCloudProof(proof, app_id as `app_${string}`, action)) as IVerifyResponse;

         if (verifyRes.success) {
            const nullifierHash = proof.nullifier_hash;
            const supabase = await createSupabaseServerClient();

            // Check if this nullifier hash is already used by a different user to prevent replay attacks
            const { data: existingUser } = await supabase
               .from('users')
               .select('id')
               .eq('nullifier_hash', nullifierHash)
               .neq('id', userId)
               .single();

            if (existingUser) {
               throw { code: ERROR_CODES.WORLDID_ALREADY_USED };
            }

            const { error: updateError } = await supabase
               .from('users')
               .update({
                  is_world_id: WorldId.ACTIVE,
                  nullifier_hash: nullifierHash
               })
               .eq('id', userId);

            if (updateError) {
               console.error('Error updating user World ID status:', updateError);
               throw { code: ERROR_CODES.SERVER_ERROR, status: 500 };
            }

            return verifyRes;
         } else {
            throw { code: ERROR_CODES.WORLDID_VERIFICATION_FAILED, status: 400 };
         }
      },
      {
         requireAuth: true,
         successCode: SUCCESS_CODES.AUTH_VERIFY_SUCCESS
      }
   );
}
