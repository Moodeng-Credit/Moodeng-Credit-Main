// Records one row in public.security_job_runs per security-job invocation, so the
// Phase 2b heartbeat can tell whether each detector actually ran and succeeded.
// Never throws — a ledger failure must not fail the job it is recording.

// deno-lint-ignore no-explicit-any
type SupabaseLike = { from: (table: string) => any };

export type JobRun = {
   startedAt: string; // ISO timestamp captured at the start of the invocation
   ok: boolean;
   signalCount?: number | null;
   detail?: Record<string, unknown>;
};

export const recordJobRun = async (supabase: SupabaseLike, jobName: string, run: JobRun): Promise<void> => {
   try {
      await supabase.from('security_job_runs').insert({
         job_name: jobName,
         started_at: run.startedAt,
         finished_at: new Date().toISOString(),
         ok: run.ok,
         signal_count: run.signalCount ?? null,
         detail: run.detail ?? {}
      });
   } catch (err) {
      console.error(`[securityJobRuns] failed to record ${jobName}:`, err instanceof Error ? err.message : err);
   }
};
