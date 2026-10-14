import { createContext } from 'react'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import type { Profile, ProfileUpdate } from '../types/profile'

export interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  signInWithPassword: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUpWithPassword: (
    email: string,
    password: string,
    displayName?: string,
    fullName?: string
  ) => Promise<{ error: AuthError | null; user: User | null }>
  signInWithGoogle: () => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  updateProfile: (updates: ProfileUpdate) => Promise<{ error: string | null; profile: Profile | null }>
  uploadAvatar: (file: File) => Promise<{ error: string | null; url: string | null }>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)
