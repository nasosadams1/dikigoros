import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AuthError, Session, User as SupabaseUser } from "@supabase/supabase-js";
import {
  clearPersistedSupabaseAuth,
  createUserProfile,
  getCurrentSession,
  getDisplayName,
  getUserProfile,
  resendConfirmationEmail,
  resetPassword as supabaseResetPassword,
  signInWithEmail,
  signInWithGoogle as supabaseSignInWithGoogle,
  signOut as supabaseSignOut,
  signUpWithEmail,
  supabase,
  updateEmail as supabaseUpdateEmail,
  updateUserProfile as supabaseUpdateUserProfile,
  type UserProfile,
} from "@/lib/supabase";

interface AuthContextType {
  user: SupabaseUser | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<{ error: AuthOperationError; needsConfirmation?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthOperationError }>;
  signInWithGoogle: () => Promise<{ error: AuthOperationError }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthOperationError }>;
  updateEmail: (email: string) => Promise<{ error: AuthOperationError }>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  applyAuthoritativeProfile: (profile: UserProfile) => Promise<void>;
  refetchProfile: () => Promise<void>;
  setNavigationCallback: (callback: () => void) => void;
  confirmUser: (email: string) => Promise<{ error: AuthOperationError }>;
}

type AuthOperationError = AuthError | Error | { message?: string } | null;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const createDefaultProfile = (user: SupabaseUser, preferredUsername?: string): Omit<UserProfile, "created_at" | "updated_at"> => {
  const userEmail = user.email || "";
  const metadataName =
    preferredUsername ||
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.user_metadata?.username ||
    userEmail.split("@")[0] ||
    "User";

  const userName = String(metadataName).trim() || "User";

  return {
    id: user.id,
    name: userName,
    email: userEmail,
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
    coins: 0,
    total_coins_earned: 0,
    xp: 0,
    completed_lessons: [],
    lifetime_completed_lessons: [],
    level: 1,
    hearts: 5,
    max_hearts: 5,
    last_heart_reset: new Date().toDateString(),
    current_avatar: "default",
    owned_avatars: ["default"],
    unlocked_achievements: [],
    current_streak: 0,
    last_login_date: "",
    total_lessons_completed: 0,
    email_verified: !!user.email_confirmed_at,
    xp_boost_multiplier: 1,
    xp_boost_expires_at: 0,
    unlimited_hearts_expires_at: 0,
  };
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigationCallbackRef = useRef<(() => void) | null>(null);

  const applySignedOutState = useCallback(() => {
    setSession(null);
    setUser(null);
    setProfile(null);
    setLoading(false);
  }, []);

  const createProfileManually = useCallback(async (authUser: SupabaseUser, preferredUsername?: string) => {
    const newProfile = createDefaultProfile(authUser, preferredUsername);
    const { data, error } = await createUserProfile(authUser.id, newProfile);

    if (error) {
      console.error("Error creating profile manually:", error);
      setLoading(false);
      return;
    }

    if (data) setProfile(data);
    setLoading(false);
  }, []);

  const fetchProfile = useCallback(
    async (authUser: SupabaseUser) => {
      try {
        const { data, error } = await getUserProfile(authUser.id);

        if (error) {
          console.error("Error fetching profile:", error);
          setLoading(false);
          return;
        }

        if (!data) {
          await createProfileManually(authUser);
          return;
        }

        const displayName = await getDisplayName(authUser.id);
        const shouldBackfillName =
          displayName &&
          displayName !== "Unknown User" &&
          (!data.name || data.name === "Unknown User");

        if (shouldBackfillName) {
          const { data: updatedProfile } = await supabaseUpdateUserProfile(authUser.id, { name: displayName });
          setProfile(updatedProfile || { ...data, name: displayName });
        } else {
          setProfile(data);
        }
        setLoading(false);
      } catch (error) {
        console.error("Unexpected error fetching profile:", error);
        setLoading(false);
      }
    },
    [createProfileManually],
  );

  const refetchProfile = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    await fetchProfile(user);
  }, [fetchProfile, user]);

  useEffect(() => {
    let isActive = true;

    void (async () => {
      const { session: currentSession, error } = await getCurrentSession();
      if (!isActive) return;

      if (error) {
        console.error("Supabase session error:", error);
        applySignedOutState();
        return;
      }

      if (currentSession?.user) {
        setSession(currentSession);
        setUser(currentSession.user);
        await fetchProfile(currentSession.user);
        return;
      }

      applySignedOutState();
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (event === "SIGNED_IN" && nextSession?.user) {
        void fetchProfile(nextSession.user);

        window.setTimeout(() => {
          navigationCallbackRef.current?.();
        }, 1000);
      } else if (event === "SIGNED_OUT") {
        applySignedOutState();
      }
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [applySignedOutState, fetchProfile]);

  const checkUsernameExists = async (username: string): Promise<boolean> => {
    const { data, error } = await supabase.from("user_profiles").select("name").eq("name", username.trim());
    if (error) {
      console.error("Error checking username:", error);
      return false;
    }

    return Boolean(data && data.length > 0);
  };

  const signUp = async (email: string, password: string, username: string) => {
    try {
      const normalizedUsername = username.trim();
      const usernameExists = await checkUsernameExists(normalizedUsername);
      if (usernameExists) return { error: { message: "Username already taken" } };

      const { data, error } = await signUpWithEmail(email.trim().toLowerCase(), password, normalizedUsername);
      if (error) return { error };

      const needsConfirmation = data?.user && !data?.session && !data?.user?.email_confirmed_at;
      return { error: null, needsConfirmation: Boolean(needsConfirmation) };
    } catch {
      return { error: { message: "Network connection failed. Please check your internet connection and try again." } };
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await signInWithEmail(email.trim().toLowerCase(), password);
    return { error };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabaseSignInWithGoogle();
    return { error };
  };

  const signOut = async () => {
    clearPersistedSupabaseAuth();
    await supabaseSignOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabaseResetPassword(email);
    return { error };
  };

  const updateEmail = async (email: string) => {
    if (!user) return { error: { message: "No authenticated user found." } };

    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabaseUpdateEmail(normalizedEmail);
    if (error) return { error };

    if (data?.user?.email === normalizedEmail) {
      const { data: updatedProfile, error: profileError } = await supabaseUpdateUserProfile(user.id, {
        email: normalizedEmail,
      });

      if (profileError) return { error: profileError };
      if (updatedProfile) setProfile(updatedProfile);
    }

    return { error: null };
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;

    const { data, error } = await supabaseUpdateUserProfile(user.id, updates);
    if (error) throw error;
    if (data) setProfile(data);
  };

  const applyAuthoritativeProfile = useCallback(async (profileData: UserProfile) => {
    setProfile(profileData);
  }, []);

  const setNavigationCallback = (callback: () => void) => {
    navigationCallbackRef.current = callback;
  };

  const confirmUser = async (email: string) => {
    const { error } = await resendConfirmationEmail(email.trim().toLowerCase());
    return { error };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        resetPassword,
        updateEmail,
        updateProfile,
        applyAuthoritativeProfile,
        refetchProfile,
        setNavigationCallback,
        confirmUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
