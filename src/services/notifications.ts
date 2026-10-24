import type { AppNotification, NotificationType } from '../types';
import { uid, nowIso } from '../lib/ids';
import { getNotifications, getNotificationsFor, saveNotifications } from './db';

export function notify(input: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}): AppNotification {
  const notification: AppNotification = {
    id: uid('ntf'),
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link,
    read: false,
    createdAt: nowIso(),
  };
  saveNotifications([notification, ...getNotifications()]);
  return notification;
}

export function listNotifications(userId: string): AppNotification[] {
  return getNotificationsFor(userId);
}

export function unreadCount(userId: string): number {
  return getNotificationsFor(userId).filter((n) => !n.read).length;
}

export function markRead(id: string): void {
  saveNotifications(getNotifications().map((n) => (n.id === id ? { ...n, read: true } : n)));
}

export function markAllRead(userId: string): void {
  saveNotifications(getNotifications().map((n) => (n.userId === userId ? { ...n, read: true } : n)));
}
