import { Injectable, inject, signal } from '@angular/core';
import {
  GoogleAuthProvider,
  User,
  deleteUser,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { FIREBASE_AUTH } from '../firebase/firebase.providers';

export interface SessionUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  /** Temporary account used by the hidden test mode. */
  isAnonymous: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(FIREBASE_AUTH);
  private readonly currentUser = signal<SessionUser | null>(null);
  private readonly initialized = signal(false);
  private readonly firstAuthState = new Promise<void>((resolve) => {
    onAuthStateChanged(this.auth, (user) => {
      this.currentUser.set(user ? toSessionUser(user) : null);
      this.initialized.set(true);
      resolve();
    });
  });

  readonly user = this.currentUser.asReadonly();
  readonly isReady = this.initialized.asReadonly();

  async waitForUser(): Promise<SessionUser | null> {
    await this.firstAuthState;
    return this.currentUser();
  }

  async signIn(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email, password);
  }

  async signInWithGoogle(): Promise<void> {
    await signInWithPopup(this.auth, new GoogleAuthProvider());
  }

  /** Starts a temporary anonymous session (test mode): it has its own empty data. */
  async signInAsGuest(): Promise<void> {
    await signInAnonymously(this.auth);
  }

  /** Deletes the signed-in account itself. Used only to remove the temporary test account. */
  async deleteCurrentUser(): Promise<void> {
    if (this.auth.currentUser) {
      await deleteUser(this.auth.currentUser);
    }
  }

  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email);
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
  }
}

function toSessionUser(user: User): SessionUser {
  return { uid: user.uid, email: user.email, displayName: user.displayName, isAnonymous: user.isAnonymous };
}
