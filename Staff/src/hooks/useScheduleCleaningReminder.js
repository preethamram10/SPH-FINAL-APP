import { useEffect } from 'react';
import { NativeModules } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

let Notifications = null;
try {
  if (NativeModules.ExpoTopicSubscriptionModule || NativeModules.ExpoPushTokenManager) {
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
} catch (e) {
  console.log('Skipped loading expo-notifications in reminder hook');
}

export const useScheduleCleaningReminder = () => {
  const { userData } = useAuth();

  useEffect(() => {
    if (!userData || userData.role !== 'receptionist') return;

    const branchId = userData.branchId || userData.branchName;
    if (!branchId) return;

    // Listen to branch settings
    const unsub = onSnapshot(doc(db, 'branch_settings', branchId), async (docSnap) => {
      const overrideDateStr = docSnap.exists() ? docSnap.data().overrideCleaningDate : null;

      // Determine if override is in current week
      const getWeekRange = (d) => {
        const date = new Date(d);
        date.setHours(0,0,0,0);
        const day = date.getDay();
        const sunday = new Date(date);
        sunday.setDate(date.getDate() - day);
        const saturday = new Date(sunday);
        saturday.setDate(sunday.getDate() + 6);
        return { start: sunday, end: saturday };
      };

      const today = new Date();
      today.setHours(0,0,0,0);
      const { start: weekStart, end: weekEnd } = getWeekRange(today);
      
      let hasValidOverride = false;
      let overrideReminderDate = null;
      if (overrideDateStr) {
        const oDate = new Date(overrideDateStr);
        oDate.setHours(0,0,0,0);
        if (oDate >= weekStart && oDate <= weekEnd) {
          hasValidOverride = true;
          overrideReminderDate = new Date(oDate);
          overrideReminderDate.setDate(oDate.getDate() - 1);
          overrideReminderDate.setHours(10, 0, 0, 0);
        }
      }

      try {
        if (!Notifications) return;

        // Request Permissions
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          console.log('Failed to get push token for push notification!');
          return;
        }

        // Cancel previously scheduled cleaning reminders
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        for (const notif of scheduled) {
          if (notif.identifier.startsWith('cleaning_reminder')) {
            await Notifications.cancelScheduledNotificationAsync(notif.identifier);
          }
        }

        // 1. Schedule default weekly reminder for Wednesday (weekday 4 in Expo, which is 1-indexed Sunday=1)
        await Notifications.scheduleNotificationAsync({
          identifier: `cleaning_reminder_default`,
          content: {
            title: 'Clinic Cleaning Tomorrow! 🧹',
            body: 'Just a reminder that tomorrow (Thursday) is your mandatory clinic cleaning day.',
            sound: true,
          },
          trigger: {
            weekday: 4, // Wednesday
            hour: 10,
            minute: 0,
            repeats: true,
          },
        });

        // 2. Schedule override reminder if applicable
        if (hasValidOverride && overrideReminderDate > new Date()) {
          await Notifications.scheduleNotificationAsync({
            identifier: `cleaning_reminder_override`,
            content: {
              title: 'Special Clinic Cleaning Tomorrow! 🧹',
              body: 'HR has set a special cleaning day for your branch tomorrow. Please prepare to upload photos.',
              sound: true,
            },
            trigger: overrideReminderDate,
          });
        }
      } catch (err) {
        console.log('Error scheduling notification:', err);
      }
    });

    return () => unsub();
  }, [userData]);
};
