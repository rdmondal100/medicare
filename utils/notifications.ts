// import * as Notifications from "expo-notifications";
// import { Platform, DeviceEventEmitter } from "react-native";
// import { Medication, recordDose, checkMissedDoses } from "./storage";
// import * as BackgroundFetch from 'expo-background-fetch';
// import * as TaskManager from 'expo-task-manager';

// const BACKGROUND_TASK = 'missed-dose-check';

// // Define task only once
// if (!TaskManager.isTaskDefined(BACKGROUND_TASK)) {
//   TaskManager.defineTask(BACKGROUND_TASK, async () => {
//     try {
//       console.log('Running background task: Checking missed doses');
//       await checkMissedDoses();
      
//       // Notify UI to update
//       DeviceEventEmitter.emit('medicationsUpdated');
      
//       return BackgroundFetch.Result.NewData;
//     } catch (error) {
//       console.error('Background task error:', error);
//       return BackgroundFetch.Result.Failed;
//     }
//   });
// }

// export async function registerBackgroundTask() {
//   try {
//     // Check if task is already registered
//     const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK);
    
//     if (!isRegistered) {
//       const status = await BackgroundFetch.registerTaskAsync(BACKGROUND_TASK, {
//         minimumInterval: 15 * 60, // 15 minutes
//         stopOnTerminate: false,
//         startOnBoot: true,
//       });
//       console.log('Background fetch status:', status);
//     } else {
//       console.log('Background task already registered');
//     }
//   } catch (err) {
//     console.error('Background task registration failed:', err);
//   }
// }

// // Configure notification handler
// export async function setupNotifications() {
//   // Set notification handler
//   Notifications.setNotificationHandler({
//     handleNotification: async () => ({
//       shouldShowAlert: true,
//       shouldPlaySound: true,
//       shouldSetBadge: true,
//     }),
//   });
  
//   // Setup notification channels
//   if (Platform.OS === "android") {
//     await Notifications.setNotificationChannelAsync("medication-reminders", {
//       name: "Medication Reminders",
//       importance: Notifications.AndroidImportance.MAX,
//       vibrationPattern: [0, 250, 250, 250],
//       lightColor: "#1a8e2d",
//       sound: "default",
//     });
    
//     await Notifications.setNotificationChannelAsync("refill-reminders", {
//       name: "Refill Reminders",
//       importance: Notifications.AndroidImportance.HIGH,
//       vibrationPattern: [0, 250, 250, 250],
//       lightColor: "#FF9800",
//       sound: "default",
//     });
//   }
// }

// // Setup notification listener
// export function setupNotificationListener() {
//   // Handle notification taps
//   const subscription = Notifications.addNotificationResponseReceivedListener(response => {
//     const { medicationId, type } = response.notification.request.content.data;
    
//     if (type === 'medication' && medicationId) {
//       const timestamp = new Date().toISOString();
//       recordDose(medicationId, true, timestamp);
//     }
//   });
  
//   return subscription;
// }

// export async function registerForPushNotificationsAsync(): Promise<string | null> {
//   try {
//     // Request permissions first
//     const { status: existingStatus } = await Notifications.getPermissionsAsync();
//     let finalStatus = existingStatus;

//     if (existingStatus !== "granted") {
//       const { status } = await Notifications.requestPermissionsAsync();
//       finalStatus = status;
//     }

//     if (finalStatus !== "granted") {
//       console.log("Notification permission not granted");
//       return null;
//     }

//     // Get token
//     const tokenData = await Notifications.getExpoPushTokenAsync({
//       projectId: "31883228-c8de-40d5-9e72-937bc88b6818",
//     });
    
//     console.log("Push token:", tokenData.data);
//     return tokenData.data;
//   } catch (error) {
//     console.error("Error getting push token:", error);
//     return null;
//   }
// }

// // Platform-specific scheduling
// export async function scheduleMedicationReminder(
//   medication: Medication
// ): Promise<string[] | undefined> {
//   if (!medication.reminderEnabled) return;

//   try {
//     const identifiers: string[] = [];
    
//     // Cancel existing notifications for this medication
//     await cancelMedicationReminders(medication.id);

//     for (const time of medication.times) {
//       const [hours, minutes] = time.split(":").map(Number);
//       const now = new Date();
      
//       // Create scheduled time
//       const scheduledTime = new Date();
//       scheduledTime.setHours(hours, minutes, 0, 0);
      
//       // If time is in the past, schedule for tomorrow
//       if (scheduledTime <= now) {
//         scheduledTime.setDate(scheduledTime.getDate() + 1);
//       }
      
//       // Platform-specific triggers
//       let trigger;
//       if (Platform.OS === 'ios') {
//         // iOS - use calendar trigger
//         trigger = {
//           type: 'calendar',
//           hour: hours,
//           minute: minutes,
//           repeats: true,
//         };
//       } else {
//         // Android - use timestamp trigger
//         const secondsUntil = Math.floor((scheduledTime.getTime() - now.getTime()) / 1000);
//         trigger = {
//           type: 'timeInterval',
//           seconds: secondsUntil,
//           repeats: false, // We'll handle repeating manually
//         };
//       }

//       // Schedule notification
//       const identifier = await Notifications.scheduleNotificationAsync({
//         content: {
//           title: "Medication Reminder",
//           body: `Time to take ${medication.name} (${medication.dosage})`,
//           data: { 
//             medicationId: medication.id,
//             type: "medication",
//           },
//           sound: true,
//           ...(Platform.OS === 'android' ? { channelId: "medication-reminders" } : {})
//         },
//         trigger,
//       });

//       console.log(`Scheduled notification for ${medication.name} at ${time} (ID: ${identifier})`);
//       identifiers.push(identifier);
      
//       // For Android, schedule the next day's notification
//       if (Platform.OS === 'android') {
//         const nextDayTrigger = {
//           type: 'timeInterval',
//           seconds: 24 * 60 * 60, // 24 hours
//           repeats: true,
//         };
        
//         const nextIdentifier = await Notifications.scheduleNotificationAsync({
//           content: {
//             title: "Medication Reminder",
//             body: `Time to take ${medication.name} (${medication.dosage})`,
//             data: { 
//               medicationId: medication.id,
//               type: "medication",
//             },
//             sound: true,
//             channelId: "medication-reminders"
//           },
//           trigger: nextDayTrigger,
//         });
        
//         console.log(`Scheduled recurring notification for ${medication.name} at ${time} (ID: ${nextIdentifier})`);
//         identifiers.push(nextIdentifier);
//       }
//     }
    
//     return identifiers;
//   } catch (error) {
//     console.error("Error scheduling medication reminder:", error);
//   }
// }

// export async function scheduleRefillReminder(
//   medication: Medication
// ): Promise<string | undefined> {
//   if (!medication.refillReminder || !medication.lastRefillDate) return;

//   try {
//     if (medication.currentSupply <= medication.refillAt) {
//       const identifier = await Notifications.scheduleNotificationAsync({
//         content: {
//           title: "Refill Reminder",
//           body: `Your ${medication.name} supply is running low. Current supply: ${medication.currentSupply}`,
//           data: { medicationId: medication.id, type: "refill" },
//           ...(Platform.OS === 'android' ? { channelId: "refill-reminders" } : {})
//         },
//         trigger: {
//           type: 'timeInterval',
//           seconds: 60 * 60 * 24, // Daily reminder
//           repeats: true
//         },
//       });
//       return identifier;
//     }
//   } catch (error) {
//     console.error("Error scheduling refill reminder:", error);
//   }
// }

// export async function cancelMedicationReminders(medicationId: string): Promise<void> {
//   try {
//     const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
//     let count = 0;

//     for (const notification of scheduledNotifications) {
//       const data = notification.content.data as { medicationId?: string } | null;
//       if (data?.medicationId === medicationId) {
//         await Notifications.cancelScheduledNotificationAsync(notification.identifier);
//         count++;
//       }
//     }
    
//     console.log(`Cancelled ${count} notifications for medication ${medicationId}`);
//   } catch (error) {
//     console.error("Error canceling medication reminders:", error);
//   }
// }

// export async function updateMedicationReminders(medication: Medication): Promise<void> {
//   try {
//     await cancelMedicationReminders(medication.id);
//     await scheduleMedicationReminder(medication);
//     await scheduleRefillReminder(medication);
//   } catch (error) {
//     console.error("Error updating medication reminders:", error);
//   }
// }

// export async function testNotification() {
//   try {
//     await Notifications.scheduleNotificationAsync({
//       content: {
//         title: "Test Notification",
//         body: "This is a test notification from MediCare!",
//         sound: true,
//         data: { test: true },
//       },
//       trigger: {
//         type: 'timeInterval',
//         seconds: 5,
//         repeats: false
//       },
//     });
//     console.log("Test notification scheduled");
//   } catch (error) {
//     console.error("Error scheduling test notification:", error);
//   }
// }

// // Use proper type for missedDoseInterval
// let missedDoseInterval: ReturnType<typeof setInterval> | null = null;

// export function startMissedDoseChecker() {
//   if (!missedDoseInterval) {
//     missedDoseInterval = setInterval(async () => {
//       console.log('Checking missed doses');
//       await checkMissedDoses();
//     }, 60000); // Check every minute
//   }
// }

// export function stopMissedDoseChecker() {
//   if (missedDoseInterval) {
//     clearInterval(missedDoseInterval);
//     missedDoseInterval = null;
//   }
// }


import * as Notifications from "expo-notifications";
import { Platform, DeviceEventEmitter } from "react-native";
import { Medication, recordDose, checkMissedDoses, markDoseAsMissed } from "./storage";
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

const BACKGROUND_TASK = 'missed-dose-check';

// Define task only once
if (!TaskManager.isTaskDefined(BACKGROUND_TASK)) {
  TaskManager.defineTask(BACKGROUND_TASK, async () => {
    try {
      console.log('Running background task: Checking missed doses');
      await checkMissedDoses();
      
      // Notify UI to update
      DeviceEventEmitter.emit('medicationsUpdated');
      
      return BackgroundFetch.Result.NewData;
    } catch (error) {
      console.error('Background task error:', error);
      return BackgroundFetch.Result.Failed;
    }
  });
}

export async function registerBackgroundTask() {
  try {
    // Check if task is already registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK);
    
    if (!isRegistered) {
      const status = await BackgroundFetch.registerTaskAsync(BACKGROUND_TASK, {
        minimumInterval: 15 * 60, // 15 minutes
        stopOnTerminate: false,
        startOnBoot: true,
      });
      console.log('Background fetch status:', status);
    } else {
      console.log('Background task already registered');
    }
  } catch (err) {
    console.error('Background task registration failed:', err);
  }
}

// Configure notification handler
export async function setupNotifications() {
  // Set notification handler
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      };
    },
  });
  
  // Setup notification channels
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("medication-reminders", {
      name: "Medication Reminders",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#1a8e2d",
      sound: "default",
    });
    
    await Notifications.setNotificationChannelAsync("refill-reminders", {
      name: "Refill Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF9800",
      sound: "default",
    });
    
    // Define notification category with actions
    await Notifications.setNotificationCategoryAsync('medication-action', [
      {
        identifier: 'take-now',
        buttonTitle: 'Take Now',
        options: {
          opensAppToForeground: true,
        },
      },
    ]);
  }
}

// Setup notification listener
export function setupNotificationListener() {
  // Handle notification taps and actions
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
    const { medicationId, type } = response.notification.request.content.data;
    const actionIdentifier = response.actionIdentifier;
    
    if (type === 'medication' && medicationId) {
      if (actionIdentifier === 'take-now') {
        const timestamp = new Date().toISOString();
        recordDose(medicationId, true, timestamp);
      } 
      else if (actionIdentifier === 'reject') {
        markDoseAsMissed(medicationId);
      }
      else if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        // User tapped notification body - record dose
        const timestamp = new Date().toISOString();
        recordDose(medicationId, true, timestamp);
      }
    }
  });
  
  return responseSubscription;
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    // Request permissions first
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowDisplayInCarPlay: true,
          allowCriticalAlerts: true,
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Notification permission not granted");
      return null;
    }

    // Get token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: "31883228-c8de-40d5-9e72-937bc88b6818",
    });
    
    console.log("Push token:", tokenData.data);
    return tokenData.data;
  } catch (error) {
    console.error("Error getting push token:", error);
    return null;
  }
}

// Foreground notification checker
let immediateChecker: ReturnType<typeof setInterval> | null = null;

export function startImmediateReminderChecker() {
  if (!immediateChecker) {
    immediateChecker = setInterval(async () => {
      try {
        const now = new Date();
        const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
        
        for (const notif of scheduledNotifications) {
          const trigger = notif.trigger as any;
          if (trigger && trigger.date) {
            const triggerTime = new Date(trigger.date);
            
            // Check if it's time to show the notification (within 1 minute)
            if (Math.abs(triggerTime.getTime() - now.getTime()) <= 60000) {
              // Show notification immediately
              await Notifications.presentNotificationAsync({
                content: {
                  ...notif.content,
                  // Add action buttons for Android
                  ...(Platform.OS === 'android' && {
                    categoryIdentifier: 'medication-action'
                  })
                },
                trigger: null
              });
              
              // Cancel the scheduled notification
              await Notifications.cancelScheduledNotificationAsync(notif.identifier);
            }
          }
        }
      } catch (error) {
        console.error("Immediate reminder check failed:", error);
      }
    }, 60000); // Check every minute
  }
}

export function stopImmediateReminderChecker() {
  if (immediateChecker) {
    clearInterval(immediateChecker);
    immediateChecker = null;
  }
}

// Platform-specific scheduling
export async function scheduleMedicationReminder(
  medication: Medication
): Promise<string[] | undefined> {
  if (!medication.reminderEnabled) return;

  try {
    const identifiers: string[] = [];
    
    // Cancel existing notifications for this medication
    await cancelMedicationReminders(medication.id);

    for (const time of medication.times) {
      const [hours, minutes] = time.split(":").map(Number);
      const now = new Date();
      
      // Create scheduled time
      const scheduledTime = new Date();
      scheduledTime.setHours(hours, minutes, 0, 0);
      
      // If time is in the past, schedule for tomorrow
      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }
      
      // Platform-specific triggers
      let trigger;
      if (Platform.OS === 'ios') {
        // iOS - use calendar trigger
        trigger = {
          type: 'calendar',
          hour: hours,
          minute: minutes,
          repeats: true,
        };
      } else {
        // Android - use exact date trigger
        trigger = {
          type: 'date',
          date: scheduledTime,
        };
      }

      // Notification content with action buttons
      const content = {
        title: "Medication Reminder",
        body: `Time to take ${medication.name} (${medication.dosage})`,
        data: { 
          medicationId: medication.id,
          type: "medication",
        },
        sound: true,
        priority: 'high' as const,
        ...(Platform.OS === 'android' ? { 
          channelId: "medication-reminders",
          categoryIdentifier: "medication-action"
        } : {})
      };

      // Schedule notification
      const identifier = await Notifications.scheduleNotificationAsync({
        content,
        trigger,
      });

      console.log(`Scheduled notification for ${medication.name} at ${time} (ID: ${identifier})`);
      identifiers.push(identifier);
    }
    
    return identifiers;
  } catch (error) {
    console.error("Error scheduling medication reminder:", error);
  }
}

export async function scheduleRefillReminder(
  medication: Medication
): Promise<string | undefined> {
  if (!medication.refillReminder || !medication.lastRefillDate) return;

  try {
    if (medication.currentSupply <= medication.refillAt) {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Refill Reminder",
          body: `Your ${medication.name} supply is running low. Current supply: ${medication.currentSupply}`,
          data: { medicationId: medication.id, type: "refill" },
          ...(Platform.OS === 'android' ? { channelId: "refill-reminders" } : {})
        },
        trigger: {
          type: 'timeInterval',
          seconds: 60 * 60 * 24, // Daily reminder
          repeats: true
        },
      });
      return identifier;
    }
  } catch (error) {
    console.error("Error scheduling refill reminder:", error);
  }
}

export async function cancelMedicationReminders(medicationId: string): Promise<void> {
  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    let count = 0;

    for (const notification of scheduledNotifications) {
      const data = notification.content.data as { medicationId?: string } | null;
      if (data?.medicationId === medicationId) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        count++;
      }
    }
    
    console.log(`Cancelled ${count} notifications for medication ${medicationId}`);
  } catch (error) {
    console.error("Error canceling medication reminders:", error);
  }
}

export async function updateMedicationReminders(medication: Medication): Promise<void> {
  try {
    await cancelMedicationReminders(medication.id);
    await scheduleMedicationReminder(medication);
    await scheduleRefillReminder(medication);
  } catch (error) {
    console.error("Error updating medication reminders:", error);
  }
}

export async function testNotification() {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Test Notification",
        body: "This is a test notification from MediCare!",
        sound: true,
        data: { test: true },
        ...(Platform.OS === 'android' ? { 
          channelId: "medication-reminders",
          categoryIdentifier: "medication-action"
        } : {})
      },
      trigger: {
        type: 'timeInterval',
        seconds: 5,
        repeats: false
      },
    });
    console.log("Test notification scheduled");
  } catch (error) {
    console.error("Error scheduling test notification:", error);
  }
}

// Use proper type for missedDoseInterval
let missedDoseInterval: ReturnType<typeof setInterval> | null = null;

export function startMissedDoseChecker() {
  if (!missedDoseInterval) {
    missedDoseInterval = setInterval(async () => {
      console.log('Checking missed doses');
      await checkMissedDoses();
    }, 60000); // Check every minute
  }
}

export function stopMissedDoseChecker() {
  if (missedDoseInterval) {
    clearInterval(missedDoseInterval);
    missedDoseInterval = null;
  }
}