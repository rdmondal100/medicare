import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import * as Notifications from 'expo-notifications';
import { SplashScreen } from "expo-router";
import { 
  setupNotifications,
  registerBackgroundTask,
  setupNotificationListener,
  startMissedDoseChecker,
  stopMissedDoseChecker,
  stopImmediateReminderChecker,
  startImmediateReminderChecker
} from "../utils/notifications";

SplashScreen.preventAutoHideAsync();

const RootLayout = () => {
  useEffect(() => {
    const initApp = async () => {
      try {
        // 1. Request notification permissions FIRST
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          alert('You need to enable notifications for reminders to work!');
        }

        // 2. Setup notifications
        await setupNotifications();
        
        // 3. Register notification listener
        const listener = setupNotificationListener();
        
        // 4. Register background task
        await registerBackgroundTask();
        
        // 5. Start foreground checkers
        startMissedDoseChecker();
        startImmediateReminderChecker();
        
        // 6. Hide splash screen when ready
        SplashScreen.hideAsync();
        
        return () => {
          listener?.remove();
          stopMissedDoseChecker();
          stopImmediateReminderChecker();
        };
      } catch (error) {
        console.error("App initialization failed:", error);
        SplashScreen.hideAsync(); // Still hide splash on error
      }
    };

    initApp();
  }, []); // Empty dependency array = runs only once on mount
  
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'white' },
          animation: 'slide_from_right',
          header: () => null,
          navigationBarHidden: true
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
    </>
  )
}

export default RootLayout;