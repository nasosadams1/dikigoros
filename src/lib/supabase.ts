import { createClient, type Session } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const appUrl = (import.meta.env.VITE_APP_URL as string | undefined)?.trim();
const normalizedAppUrl = appUrl?.replace(/\/+$/, "") || "";
const authStorageKey = "codhak-auth";
const publicAuthStorageKey = "codhak-public-anon-auth";

const isLocalhostUrl = (value: string) =>
  /^https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?$/i.test(value);

const getBaseUrl = () => {
  const browserOrigin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin.replace(/\/+$/, "")
      : "";

  if (browserOrigin && !isLocalhostUrl(browserOrigin) && (!normalizedAppUrl || isLocalhostUrl(normalizedAppUrl))) {
    return browserOrigin;
  }

  return normalizedAppUrl || browserOrigin || "http://localhost:8080";
};

const buildRedirectUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getBaseUrl()}${normalizedPath}`;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizeUsername = (username: string) => username.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: authStorageKey,
    flowType: "implicit",
  },
});

// Partner/public requests must stay detached from browser auth storage.
// Otherwise a stale JWT can override the anon role and make public RPCs fail.
export const publicSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  accessToken: async () => supabaseAnonKey,
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
    storageKey: publicAuthStorageKey,
  },
  global: {
    headers: {
      apikey: supabaseAnonKey,
    },
  },
});

export const getSupabaseAnonKey = () => supabaseAnonKey;

export const getSupabaseFunctionUrl = (functionName: string) =>
  `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/${functionName.replace(/^\/+/, "")}`;

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  preferred_language?: string;
  preferred_consultation_mode?: "any" | "video" | "phone" | "inPerson";
  preferred_legal_categories?: string[];
  budget_range?: string;
  urgency_preference?: string;
  notification_preferences?: {
    email?: boolean;
    sms?: boolean;
    reminders?: boolean;
  };
  privacy_settings?: {
    share_phone_with_booked_lawyers?: boolean;
    allow_document_access_by_booking?: boolean;
    product_updates?: boolean;
  };
  saved_lawyer_ids?: string[];
  compared_lawyer_ids?: string[];
  lawyer_notes?: Record<string, string>;
  coins: number;
  total_coins_earned: number;
  xp: number;
  completed_lessons: string[];
  lifetime_completed_lessons?: string[];
  level: number;
  hearts: number;
  max_hearts: number;
  last_heart_reset: string;
  current_avatar: string;
  owned_avatars: string[];
  unlocked_achievements: string[];
  current_streak: number;
  last_login_date: string;
  total_lessons_completed: number;
  email_verified: boolean;
  created_at?: string;
  updated_at?: string;
  xp_boost_multiplier?: number;
  xp_boost_expires_at?: number;
  unlimited_hearts_expires_at?: number;
}

export const clearPersistedSupabaseAuth = () => {
  if (typeof window === "undefined") return;

  const shouldRemove = (key: string) =>
    key === authStorageKey || key.startsWith("sb-") || key.toLowerCase().includes("supabase");

  for (const storage of [window.localStorage, window.sessionStorage]) {
    const keysToRemove: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && shouldRemove(key)) keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => storage.removeItem(key));
  }
};

export const getCurrentSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  return { session: data.session, error };
};

export const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  return { user: data.user, error };
};

export const getVerifiedSession = async () => {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  let session = sessionData.session;
  if (sessionError || !session?.access_token) {
    return { session: null, user: null, error: sessionError || new Error("AUTH_REQUIRED") };
  }

  const expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0;
  const shouldRefresh = expiresAtMs > 0 && expiresAtMs <= Date.now() + 5 * 60 * 1000;
  if (shouldRefresh) {
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshData.session?.access_token) {
      return { session: null, user: null, error: refreshError || new Error("AUTH_REQUIRED") };
    }
    session = refreshData.session;
  }

  let { data: userData, error: userError } = await supabase.auth.getUser(session.access_token);
  if (userError || !userData.user) {
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshData.session?.access_token) {
      return { session: null, user: null, error: refreshError || userError || new Error("AUTH_REQUIRED") };
    }

    session = refreshData.session;
    const retry = await supabase.auth.getUser(session.access_token);
    userData = retry.data;
    userError = retry.error;
  }

  if (userError || !userData.user) {
    return { session: null, user: null, error: userError || new Error("AUTH_REQUIRED") };
  }

  return { session, user: userData.user, error: null };
};

export const getDisplayName = async (userId: string) => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || user.id !== userId) return null;

  return (
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.user_metadata?.username ||
    "Unknown User"
  );
};

export const createUserProfile = async (userId: string, userData: Partial<UserProfile>) => {
  const displayName = await getDisplayName(userId);
  const profileData = {
    id: userId,
    ...userData,
    name: displayName || userData.name || "Unknown User",
  };

  const { data, error } = await supabase.from("user_profiles").insert([profileData]).select().maybeSingle();
  return { data, error };
};

export const getUserProfile = async (userId: string) => {
  const { data, error } = await supabase.from("user_profiles").select("*").eq("id", userId).maybeSingle();
  return { data, error };
};

export const updateUserProfile = async (userId: string, updates: Partial<UserProfile>) => {
  const updatesWithTimestamp = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("user_profiles")
    .update(updatesWithTimestamp)
    .eq("id", userId)
    .select()
    .maybeSingle();

  return { data, error };
};

export const signUpWithEmail = async (email: string, password: string, username: string) => {
  try {
    const normalizedEmail = normalizeEmail(email);
    const normalizedUsername = normalizeUsername(username);

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: buildRedirectUrl("/auth/confirm"),
        data: {
          username: normalizedUsername,
          display_name: normalizedUsername,
          full_name: normalizedUsername,
          name: normalizedUsername,
        },
      },
    });

    if (error) return { data: null, error };

    const identities = Array.isArray((data?.user as { identities?: unknown[] } | null)?.identities)
      ? (data?.user as { identities?: unknown[] }).identities
      : null;
    const looksLikeObfuscatedExistingUser =
      !!data?.user &&
      !data?.session &&
      !data?.user?.email_confirmed_at &&
      Array.isArray(identities) &&
      identities.length === 0;

    if (looksLikeObfuscatedExistingUser) {
      return { data: null, error: { message: "User already registered" } };
    }

    if (data.user && (data.session || data.user.email_confirmed_at)) {
      const profileResult = await supabase.from("user_profiles").upsert({
        id: data.user.id,
        name: data.user.user_metadata?.display_name || normalizedUsername,
        email: normalizedEmail,
        phone: "",
        city: "",
        preferred_language: "Ελληνικά",
        preferred_consultation_mode: "any",
        preferred_legal_categories: [],
        budget_range: "",
        urgency_preference: "",
        notification_preferences: {
          email: true,
          sms: false,
          reminders: true,
        },
        privacy_settings: {
          share_phone_with_booked_lawyers: true,
          allow_document_access_by_booking: true,
          product_updates: false,
        },
        saved_lawyer_ids: [],
        compared_lawyer_ids: [],
        lawyer_notes: {},
        xp: 0,
        level: 1,
        coins: 0,
        total_coins_earned: 0,
        completed_lessons: [],
        lifetime_completed_lessons: [],
        hearts: 5,
        max_hearts: 5,
        last_heart_reset: new Date().toDateString(),
        current_avatar: "default",
        owned_avatars: ["default"],
        unlocked_achievements: [],
        current_streak: 0,
        last_login_date: "",
        total_lessons_completed: 0,
        email_verified: !!data.user.email_confirmed_at,
        xp_boost_multiplier: 1,
        xp_boost_expires_at: 0,
        unlimited_hearts_expires_at: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (profileResult.error) {
        console.error("Error creating profile:", profileResult.error);
      }
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

export const signInWithEmail = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const signInWithGoogle = async () => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: buildRedirectUrl("/auth/confirm"),
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const signOut = async () => {
  clearPersistedSupabaseAuth();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  return { error };
};

export const resetPassword = async (email: string) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
    redirectTo: buildRedirectUrl("/auth/reset-password"),
  });

  return { data, error };
};

export const resendConfirmationEmail = async (email: string) => {
  const { data, error } = await supabase.auth.resend({
    type: "signup",
    email: normalizeEmail(email),
    options: {
      emailRedirectTo: buildRedirectUrl("/auth/confirm"),
    },
  });

  return { data, error };
};

export const updateEmail = async (email: string) => {
  const { data, error } = await supabase.auth.updateUser({
    email: normalizeEmail(email),
  });

  return { data, error };
};

export type AuthSession = Session;
