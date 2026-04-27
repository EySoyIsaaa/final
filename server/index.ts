/**
 * Production/server entrypoint.
 * Delegates to the unified core server bootstrap so build/start and dev share
 * the same API surface (/api/trpc, OAuth callback, static serving).
 */
import "./_core/index";
