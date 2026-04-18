export const isAutomatedDemoRuntime =
  import.meta.env.VITE_AUTOMATED_DEMO === "true" || import.meta.env.VITE_ENABLE_DEMO_MODE === "true";

export const isTestRuntime = import.meta.env.MODE === "test";

export const isProductionRuntime = import.meta.env.PROD && !isTestRuntime && !isAutomatedDemoRuntime;

export const allowLocalCriticalFallback =
  isTestRuntime ||
  isAutomatedDemoRuntime ||
  (import.meta.env.DEV && import.meta.env.VITE_ENABLE_LOCAL_CRITICAL_FALLBACK === "true");

export const failClosedCriticalPath = (surface: string) =>
  new Error(`${surface} is temporarily unavailable. Please try again shortly.`);
