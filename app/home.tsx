import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  Modal,
  Alert,
  AppState,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import {
  getMedications,
  Medication,
  getTodaysDoses,
  recordDose,
  DoseHistory,
  checkMissedDoses,
  getDoseStatus,
} from "../utils/storage";
import { useFocusEffect } from "@react-navigation/native";
import {
  registerForPushNotificationsAsync,
  scheduleMedicationReminder,
} from "../utils/notifications";
import { convertToAmPm } from "@/utils/timeConvertAmPm";

const { width } = Dimensions.get("window");

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const QUICK_ACTIONS = [
  { icon: "add-circle-outline", label: "Add\nMedication", route: "/medications/add", color: "#2E7D32", gradient: ["#4CAF50", "#2E7D32"] },
  { icon: "calendar-outline", label: "Calendar\nView", route: "/calendar", color: "#1976D2", gradient: ["#2196F3", "#1976D2"] },
  { icon: "time-outline", label: "History\nLog", route: "/history", color: "#C2185B", gradient: ["#E91E63", "#C2185B"] },
  { icon: "medkit-outline", label: "Refill\nTracker", route: "/refills", color: "#E64A19", gradient: ["#FF5722", "#E64A19"] },
];

interface CircularProgressProps {
  progress: number;
  totalDoses: number;
  completedDoses: number;
}

function CircularProgress({ progress, totalDoses, completedDoses }: CircularProgressProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const size = width * 0.55;
  const strokeWidth = 15;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: progress,
      duration: 1500,
      useNativeDriver: true,
    }).start();
  }, [progress]);

  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressTextContainer}>
        <Text style={styles.progressPercentage}>
          {Math.round(progress * 100)}%
        </Text>
        <Text style={styles.progressDetails}>
          {completedDoses} of {totalDoses} doses
        </Text>
      </View>
      <Svg width={size} height={size} style={styles.progressRing}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="white"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [todaysMedications, setTodaysMedications] = useState<Medication[]>([]);
  const [doseHistory, setDoseHistory] = useState<DoseHistory[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date()); // Track current time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000); // Update every 30 seconds

    return () => clearInterval(timer);
  }, []);

  const loadMedications = useCallback(async () => {
    try {
      await checkMissedDoses();
      const [allMedications, todaysDoses] = await Promise.all([
        getMedications(),
        getTodaysDoses(),
      ]);

      setDoseHistory(todaysDoses);
      setMedications(allMedications);

      const today = new Date();
      const todayMeds = allMedications.filter((med) => {
        const startDate = new Date(med.startDate);
        
        // Handle ongoing medications
        if (med.duration === "Ongoing" || parseInt(med.duration.split(" ")[0]) === -1) {
          return today >= startDate;
        }
        
        // Handle fixed duration medications
        const durationDays = parseInt(med.duration.split(" ")[0]);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + durationDays);
        
        return today >= startDate && today <= endDate;
      });

      setTodaysMedications(todayMeds);
    } catch (error) {
      console.error("Error loading medications:", error);
      Alert.alert("Error", "Failed to load medications. Please try again.");
    }
  }, []);

  const setupNotifications = async () => {
    try {
      const token = await registerForPushNotificationsAsync();
      if (!token) return;

      const medications = await getMedications();
      for (const medication of medications) {
        if (medication.reminderEnabled) {
          await scheduleMedicationReminder(medication);
        }
      }
    } catch (error) {
      console.error("Error setting up notifications:", error);
    }
  };

  useEffect(() => {
    // Load data when component mounts
    loadMedications();
    setupNotifications();

    // Reload when app comes to foreground
    const appStateSubscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") loadMedications();
    });

    return () => {
      appStateSubscription.remove();
    };
  }, []);

  useFocusEffect(useCallback(() => { 
    loadMedications(); 
  }, [loadMedications]));

   const handleTakeDose = async (medication: Medication, time: string) => {
  try {
    const [hours, minutes] = time.split(':').map(Number);
    const scheduledTime = new Date();
    scheduledTime.setHours(hours, minutes, 0, 0);
    
    // For missed doses, use the scheduled time (past time)
    // instead of current time
    const doseTime = new Date();
    
    // Check if the scheduled time is in the past
    if (scheduledTime < doseTime) {
      doseTime.setTime(scheduledTime.getTime());
    }
    
    await recordDose(
      medication.id, 
      true, 
      doseTime.toISOString(),
      scheduledTime.toISOString()
    );
    await loadMedications();
    
    // Show confirmation
    Alert.alert(
      "Dose Recorded",
      `${medication.name} taken at ${convertToAmPm(doseTime.toTimeString().slice(0, 5))}`,
      [{ text: "OK" }]
    );
  } catch (error) {
    console.error("Error recording dose:", error);
    Alert.alert("Error", "Failed to record dose. Please try again.");
  }
};

    const doseEvents = todaysMedications.flatMap((medication) => {
    return medication.times.map((time) => {
      const [hours, minutes] = time.split(':').map(Number);
      const scheduledTime = new Date();
      scheduledTime.setHours(hours, minutes, 0, 0);
      
      const status = getDoseStatus(
        scheduledTime.toISOString(), 
        doseHistory.filter(d => d.medicationId === medication.id),
        10, // 10 minutes grace period
        currentTime // Pass current time
      );

      return {
        medication,
        time,
        status,
        scheduledTime: scheduledTime.toISOString()
      };
    });
  });

  // Add this useEffect hook
useEffect(() => {
  const interval = setInterval(() => {
    // Only update if there are pending doses
    if (doseEvents.some(event => event.status === 'pending' || event.status === 'upcoming')) {
      loadMedications();
    }
  }, 60000); // Check every minute

  return () => clearInterval(interval);
}, [doseEvents]);

  const sortedDoseEvents = [...doseEvents].sort((a, b) => {
    const [aHours, aMinutes] = a.time.split(':').map(Number);
    const [bHours, bMinutes] = b.time.split(':').map(Number);
    return aHours - bHours || aMinutes - bMinutes;
  });

  const totalDoses = doseEvents.length;
  const completedDoses = doseEvents.filter(event => event.status === 'taken').length;
  const progress = totalDoses > 0 ? completedDoses / totalDoses : 0;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#1a8e2d", "#146922"]} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <View style={styles.flex1}>
              <Text style={styles.greeting}>Daily Progress</Text>
            </View>
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => setShowNotifications(true)}
            >
              <Ionicons name="notifications-outline" size={24} color="white" />
              {todaysMedications.length > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationCount}>
                    {todaysMedications.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          <CircularProgress
            progress={progress}
            totalDoses={totalDoses}
            completedDoses={completedDoses}
          />
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {QUICK_ACTIONS.map((action) => (
              <Link href={action.route} key={action.label} asChild>
                <TouchableOpacity style={styles.actionButton}>
                  <LinearGradient
                    colors={action.gradient}
                    style={styles.actionGradient}
                  >
                    <View style={styles.actionContent}>
                      <View style={styles.actionIcon}>
                        <Ionicons name={action.icon} size={28} color="white" />
                      </View>
                      <Text style={styles.actionLabel}>{action.label}</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </Link>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Schedule</Text>
            <Link href="/calendar" asChild>
              <TouchableOpacity>
                <Text style={styles.seeAllButton}>See All</Text>
              </TouchableOpacity>
            </Link>
          </View>
          {sortedDoseEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="medical-outline" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>
                No medications scheduled for today
              </Text>
              <Link href="/medications/add" asChild>
                <TouchableOpacity style={styles.addMedicationButton}>
                  <Text style={styles.addMedicationButtonText}>
                    Add Medication
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          ) : (
            sortedDoseEvents.map((doseEvent) => {
              const { medication, time, status } = doseEvent;
              
              return (
                <View key={`${medication.id}-${time}`} style={styles.doseCard}>
                  <View style={[styles.medicationColor, { backgroundColor: medication.color }]} />
                  <View style={styles.medicationInfo}>
                    <Text style={styles.medicineName}>{medication.name}</Text>
                    <Text style={styles.dosageInfo}>{medication.dosage}</Text>
                    <View style={styles.doseTime}>
                      <Ionicons name="time-outline" size={16} color="#666" />
                      <Text style={styles.timeText}>{convertToAmPm(time)}</Text>
                    </View>
                  </View>
                  {status === 'taken' ? (
                    <View style={styles.takenBadge}>
                      <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                      <Text style={styles.takenText}>Taken</Text>
                    </View>
                  ) : status === 'missed' ?   (
    <View style={styles.missedContainer}>
      <View style={styles.missedBadge}>
        <Ionicons name="close-circle" size={16} color="#F44336" />
        <Text style={styles.missedText}>Missed</Text>
      </View>
      <TouchableOpacity
        style={[styles.takeDoseButton, styles.missedTakeButton]}
        onPress={() => handleTakeDose(medication, time)}
      >
        <Ionicons name="medical" size={16} color="white" />
        <Text style={styles.takeDoseText}>Take Now</Text>
      </TouchableOpacity>
    </View>
  ) : status === 'pending' ? (
                    <TouchableOpacity
                      style={[styles.takeDoseButton, styles.pendingButton]}
                      onPress={() => handleTakeDose(medication, time)}
                    >
                      <Text style={styles.takeDoseText}>Take Now</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.takeDoseButton, { backgroundColor: medication.color }]}
                      onPress={() => handleTakeDose(medication, time)}
                    >
                      <Text style={styles.takeDoseText}>Take</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>
      </View>

      <Modal
        visible={showNotifications}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNotifications(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notifications</Text>
              <TouchableOpacity
                onPress={() => setShowNotifications(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            {todaysMedications.map((medication) => (
              <View key={medication.id} style={styles.notificationItem}>
                <View style={styles.notificationIcon}>
                  <Ionicons name="medical" size={24} color={medication.color} />
                </View>
                <View style={styles.notificationContent}>
                  <Text style={styles.notificationTitle}>{medication.name}</Text>
                  <Text style={styles.notificationMessage}>{medication.dosage}</Text>
                  <Text style={styles.notificationTime}>
                    {medication.times.map(t => convertToAmPm(t)).join(", ")}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  header: { paddingTop: 50, paddingBottom: 25, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerContent: { alignItems: "center", paddingHorizontal: 20 },
  headerTop: { flexDirection: "row", alignItems: "center", width: "100%", marginBottom: 20 },
  greeting: { fontSize: 18, fontWeight: "600", color: "white", opacity: 0.9 },
  content: { flex: 1, paddingTop: 20 },
  quickActionsContainer: { paddingHorizontal: 20, marginBottom: 25 },
  quickActionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 15 },
  actionButton: { width: (width - 52) / 2, height: 110, borderRadius: 16, overflow: "hidden" },
  actionGradient: { flex: 1, padding: 15 },
  actionContent: { flex: 1, justifyContent: "space-between" },
  actionIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255, 255, 255, 0.2)", justifyContent: "center", alignItems: "center" },
  actionLabel: { fontSize: 14, fontWeight: "600", color: "white", marginTop: 8 },
  section: { paddingHorizontal: 20 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: "#1a1a1a", marginBottom: 5 },
  seeAllButton: { color: "#2E7D32", fontWeight: "600" },
  doseCard: { flexDirection: "row", alignItems: "center", padding: 16, marginBottom: 12, backgroundColor: "white", borderRadius: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  medicationColor: { width: 8, height: 40, borderRadius: 4, marginRight: 15 },
  medicationInfo: { flex: 1 },
  medicineName: { fontSize: 16, fontWeight: "600", color: "#333", marginBottom: 4 },
  dosageInfo: { fontSize: 14, color: "#666", marginBottom: 4 },
  doseTime: { flexDirection: "row", alignItems: "center" },
  timeText: { marginLeft: 5, color: "#666", fontSize: 14 },
  takeDoseButton: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 15, marginLeft: 10 },
  takeDoseText: { color: "white", fontWeight: "600", fontSize: 14 },
  progressContainer: { alignItems: "center", justifyContent: "center", marginVertical: 10 },
  progressTextContainer: { position: "absolute", alignItems: "center", justifyContent: "center", zIndex: 1 },
  progressPercentage: { fontSize: 36, fontWeight: "bold", color: "white" },
  progressLabel: { fontSize: 14, color: "rgba(255, 255, 255, 0.9)", marginTop: 4 },
  progressRing: { transform: [{ rotate: "-90deg" }] },
  flex1: { flex: 1 },
  notificationButton: { position: "relative", padding: 8, backgroundColor: "rgba(255, 255, 255, 0.15)", borderRadius: 12, marginLeft: 8 },
  notificationBadge: { position: "absolute", top: -4, right: -4, backgroundColor: "#FF5252", minWidth: 20, height: 20, borderRadius: 10, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#146922", paddingHorizontal: 4 },
  notificationCount: { color: "white", fontSize: 11, fontWeight: "bold" },
  progressDetails: { fontSize: 14, color: "rgba(255, 255, 255, 0.8)", marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "white", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "80%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#333" },
  closeButton: { padding: 5 },
  notificationItem: { flexDirection: "row", padding: 15, borderRadius: 12, backgroundColor: "#f5f5f5", marginBottom: 10 },
  notificationIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#E8F5E9", justifyContent: "center", alignItems: "center", marginRight: 15 },
  notificationContent: { flex: 1 },
  notificationTitle: { fontSize: 16, fontWeight: "600", color: "#333", marginBottom: 4 },
  notificationMessage: { fontSize: 14, color: "#666", marginBottom: 4 },
  notificationTime: { fontSize: 12, color: "#999" },
  emptyState: { alignItems: "center", padding: 30, backgroundColor: "white", borderRadius: 16, marginTop: 10 },
  emptyStateText: { fontSize: 16, color: "#666", marginTop: 10, marginBottom: 20 },
  addMedicationButton: { backgroundColor: "#1a8e2d", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  addMedicationButtonText: { color: "white", fontWeight: "600" },
  takenBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#E8F5E9", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginLeft: 10 },
  takenText: { color: "#4CAF50", fontWeight: "600", fontSize: 14, marginLeft: 4 },
  missedContainer: { flexDirection: 'row', alignItems: 'center' },
  missedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFEBEE', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, marginRight: 10 },
  missedText: { color: '#F44336', marginLeft: 5, fontSize: 14 },
  pendingButton: { backgroundColor: '#FFA000' },
    missedTakeButton: {
    backgroundColor: '#FF5252',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 15,
    marginLeft: 10,
  },
});