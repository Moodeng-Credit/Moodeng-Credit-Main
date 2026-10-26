// Third-party keys for the call calendars (Emma's Calendly token, George's Google Calendar key and
// id) live in the database vault — the project is at its edge-secret cap. read_call_secret() hands
// back only those names, and only to the service role.

// deno-lint-ignore no-explicit-any
export const readCallSecret = async (svc: any, name: string): Promise<string> => {
   const { data, error } = await svc.rpc('read_call_secret', { secret_name: name });
   if (error) console.error(`callSecrets: could not read ${name}`, error.message);
   return typeof data === 'string' ? data : '';
};
