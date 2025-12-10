import { mergeQueryKeys } from '@lukemorales/query-key-factory';

import { users } from '@/query/keys/users';

export const queries = mergeQueryKeys(users);
