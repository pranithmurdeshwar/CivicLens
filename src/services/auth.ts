/**
 * Demo authentication. CivicLens AI is a front-end prototype: sessions are a
 * simple user switcher (no real auth). It exists to model and demonstrate the
 * authorization assumptions (resident vs admin) that the real backend must
 * enforce — see the authorization tests.
 */
import type { Actor, User } from '../types';
import { daysAgo } from '../lib/ids';
import { getSessionUserId, listUsers, setSessionUserId } from './db';

/** Fictional demo citizens + one admin. (Seeded into storage on boot.) */
export const DEMO_USERS: User[] = [
  {
    id: 'u-aarav',
    name: 'Aarav Sharma',
    email: 'aarav.s@example.com',
    role: 'resident',
    ward: 'Ward 45 — Jayanagar',
    area: 'Jayanagar',
    city: 'Bengaluru (demo)',
    publicRecognitionOptIn: true,
    avatarInitials: 'AS',
    joinedAt: daysAgo(120),
    bio: 'Resident of Jayanagar. Reports what he sees on his daily walk.',
  },
  {
    id: 'u-priya',
    name: 'Priya Nair',
    email: 'priya.n@example.com',
    role: 'resident',
    ward: 'Ward 32 — Indiranagar',
    area: 'Indiranagar',
    city: 'Bengaluru (demo)',
    publicRecognitionOptIn: false,
    avatarInitials: 'PN',
    joinedAt: daysAgo(60),
  },
  {
    id: 'u-rahul',
    name: 'Rahul Verma',
    email: 'rahul.v@example.com',
    role: 'resident',
    ward: 'Ward 45 — Jayanagar',
    area: 'Jayanagar',
    city: 'Bengaluru (demo)',
    publicRecognitionOptIn: true,
    avatarInitials: 'RV',
    joinedAt: daysAgo(45),
  },
  {
    id: 'u-devika',
    name: 'Devika Rao',
    email: 'devika.r@example.com',
    role: 'resident',
    ward: 'Ward 21 — Whitefield',
    area: 'Whitefield',
    city: 'Bengaluru (demo)',
    publicRecognitionOptIn: true,
    avatarInitials: 'DR',
    joinedAt: daysAgo(300),
    bio: 'Community volunteer coordinating neighbourhood clean-up drives.',
  },
  {
    id: 'u-meera',
    name: 'Meera Iyer',
    email: 'meera.i@example.com',
    role: 'admin',
    ward: 'Municipal moderation team (demo)',
    area: '—',
    city: 'Bengaluru (demo)',
    publicRecognitionOptIn: false,
    avatarInitials: 'MI',
    joinedAt: daysAgo(365),
    bio: 'Authorised administrator for the demo municipality.',
  },
];

export const SYSTEM_ACTOR: Actor = { id: 'system', role: 'admin', kind: 'system' };

export function listAllUsers(): User[] {
  return listUsers();
}

export function getCurrentUser(): User {
  const users = listAllUsers();
  const session = getSessionUserId();
  return (
    users.find((u) => u.id === session) ??
    users.find((u) => u.id === 'u-aarav') ??
    users[0]
  );
}

export function switchUser(userId: string): User {
  const user = listAllUsers().find((u) => u.id === userId);
  if (!user) throw new Error('Unknown demo user.');
  setSessionUserId(userId);
  return user;
}

export function userToActor(user: User): Actor {
  return { id: user.id, role: user.role, kind: 'user' };
}

export function isLoggedIn(): boolean {
  return getSessionUserId() != null;
}

export function logout(): void {
  setSessionUserId(null);
}

export function currentUserActor(): Actor {
  return userToActor(getCurrentUser());
}
