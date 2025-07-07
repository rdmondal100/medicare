import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  getMedications,
  getDoseHistory,
  recordDose,
  Medication,
  DoseHistory,
  checkMissedDoses,
  getDoseStatus, // Make sure to import this
} from "../../utils/storage";
import { useFocusEffect } from "@react-navigation/native";
import { convertToAmPm } from "@/utils/timeConvertAmPm";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [medications, setMedications] = useState<Medication[]>([]);
  const [doseHistory, setDoseHistory] = useState<DoseHistory[]>([]);

  const loadData = useCallback(async () => {
    try {
      await checkMissedDoses();
      const [meds, history] = await Promise.all([
        getMedications(),
        getDoseHistory(),
      ]);
      setMedications(meds);
      setDoseHistory(history);
    } catch (error) {
      console.error("Error loading calendar data:", error);
      Alert.alert("Error", "Failed to load calendar data. Please try again.");
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // Update calendar when selected date changes
  useEffect(() => {
    loadData();
  }, [selectedDate]);

  // Add this useEffect hook
useEffect(() => {
  const interval = setInterval(() => {
    // Only update if selected date is today
    if (selectedDate.toDateString() === new Date().toDateString()) {
      loadData();
    }
  }, 60000); // Check every minute

  return () => clearInterval(interval);
}, [selectedDate]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    return { days, firstDay };
  };

  const { days, firstDay } = getDaysInMonth(selectedDate);

  const renderCalendar = () => {
    const calendar: JSX.Element[] = [];
    let week: JSX.Element[] = [];

    // Add empty days for first week
    for (let i = 0; i < firstDay; i++) {
      week.push(<View key={`empty-${i}`} style={styles.calendarDay} />);
    }

    // Add actual days
    for (let day = 1; day <= days; day++) {
      const date = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        day
      );
      const isToday = new Date().toDateString() === date.toDateString();
      const hasDoses = doseHistory.some((dose) => {
        const doseDate = new Date(dose.timestamp);
        return doseDate.toDateString() === date.toDateString();
      });

      week.push(
        <TouchableOpacity
          key={day}
          style={[
            styles.calendarDay,
            isToday && styles.today,
            hasDoses && styles.hasEvents,
          ]}
          onPress={() => setSelectedDate(date)}
        >
          <Text style={[styles.dayText, isToday && styles.todayText]}>
            {day}
          </Text>
          {hasDoses && <View style={styles.eventDot} />}
        </TouchableOpacity>
      );

      // Start new row after 7 days
      if (week.length === 7) {
        calendar.push(
          <View key={`week-${day}`} style={styles.calendarWeek}>
            {week}
          </View>
        );
        week = [];
      }
    }

    // Add remaining days in last week
    if (week.length > 0) {
      calendar.push(
        <View key={`week-${days}`} style={styles.calendarWeek}>
          {week}
        </View>
      );
    }

    return calendar;
  };

  const handleTakeDose = async (medication: Medication, time: string) => {
    try {
      const [hours, minutes] = time.split(":").map(Number);
      const scheduledTime = new Date(selectedDate);
      scheduledTime.setHours(hours, minutes, 0, 0);
      
      await recordDose(
        medication.id,
        true,
        new Date().toISOString(),
        scheduledTime.toISOString()
      );
      await loadData();
    } catch (error) {
      console.error("Error recording dose:", error);
      Alert.alert("Error", "Failed to record dose. Please try again.");
    }
  };

  const renderMedicationsForDate = () => {
    const dateStr = selectedDate.toDateString();
    
    // Get doses for selected date
    const dayDoses = doseHistory.filter(
      (dose) => new Date(dose.timestamp).toDateString() === dateStr
    );

    // Create dose events for each medication
    const doseEvents = medications.flatMap((medication) => {
      return medication.times.map((time) => {
        const [eventHours, eventMinutes] = time.split(":").map(Number);
        const scheduledTime = new Date(selectedDate);
        scheduledTime.setHours(eventHours, eventMinutes, 0, 0);
        
        // FIX: Use getDoseStatus for consistent status calculation
        const status = getDoseStatus(
          scheduledTime.toISOString(),
          dayDoses.filter(d => d.medicationId === medication.id),
          10 // 10 minutes grace period
        );

        return {
          medication,
          time,
          status,
          scheduledTime: scheduledTime.toISOString(),
        };
      });
    });

    // Sort by time
    const sortedDoseEvents = [...doseEvents].sort((a, b) => {
      const [aHours, aMinutes] = a.time.split(":").map(Number);
      const [bHours, bMinutes] = b.time.split(":").map(Number);
      return aHours - bHours || aMinutes - bMinutes;
    });

    if (sortedDoseEvents.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="medical-outline" size={48} color="#ccc" />
          <Text style={styles.emptyStateText}>
            No medications scheduled for this day
          </Text>
        </View>
      );
    }

    return sortedDoseEvents.map((doseEvent) => {
      const { medication, time, status } = doseEvent;
      
      return (
        <View
          key={`${medication.id}-${time}`}
          style={styles.medicationCard}
        >
          <View
            style={[
              styles.medicationColor,
              { backgroundColor: medication.color },
            ]}
          />
          <View style={styles.medicationInfo}>
            <Text style={styles.medicationName}>{medication.name}</Text>
            <Text style={styles.medicationDosage}>{medication.dosage}</Text>
            <View style={styles.doseTime}>
              <Ionicons name="time-outline" size={16} color="#666" />
              <Text style={styles.medicationTime}>{convertToAmPm(time)}</Text>
            </View>
          </View>
          
          {status === 'taken' ? (
            <View style={styles.takenBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.takenText}>Taken</Text>
            </View>
          ) : status === 'missed' ? (
            <View style={styles.missedBadge}>
              <Ionicons name="close-circle" size={16} color="#F44336" />
              <Text style={styles.missedText}>Missed</Text>
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
    });
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#1a8e2d", "#146922"]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      />

      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={28} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Calendar</Text>
        </View>

        <View style={styles.calendarContainer}>
          <View style={styles.monthHeader}>
            <TouchableOpacity
              onPress={() =>
                setSelectedDate(
                  new Date(
                    selectedDate.getFullYear(),
                    selectedDate.getMonth() - 1,
                    1
                  )
                )
              }
            >
              <Ionicons name="chevron-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.monthText}>
              {selectedDate.toLocaleString("default", {
                month: "long",
                year: "numeric",
              })}
            </Text>
            <TouchableOpacity
              onPress={() =>
                setSelectedDate(
                  new Date(
                    selectedDate.getFullYear(),
                    selectedDate.getMonth() + 1,
                    1
                  )
                )
              }
            >
              <Ionicons name="chevron-forward" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.weekdayHeader}>
            {WEEKDAYS.map((day) => (
              <Text key={day} style={styles.weekdayText}>
                {day}
              </Text>
            ))}
          </View>

          <ScrollView contentContainerStyle={styles.calendarScroll}>
            {renderCalendar()}
          </ScrollView>
        </View>

        <View style={styles.scheduleContainer}>
          <Text style={styles.scheduleTitle}>
            {selectedDate.toLocaleDateString("default", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </Text>
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.doseList}
          >
            {renderMedicationsForDate()}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  headerGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 150,
  },
  content: {
    flex: 1,
    marginTop: Platform.OS === "ios" ? 50 : 30,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    marginRight: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
    marginLeft: 10,
  },
  calendarContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 15,
    margin: 20,
    marginTop: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    maxHeight: 350,
  },
  calendarScroll: {
    flexGrow: 1,
  },
  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  monthText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  weekdayHeader: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 10,
  },
  weekdayText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
    width: 40,
    textAlign: "center",
  },
  calendarWeek: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 5,
  },
  calendarDay: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    margin: 2,
  },
  dayText: {
    fontSize: 16,
    color: "#333",
  },
  today: {
    backgroundColor: "#1a8e2d",
  },
  todayText: {
    color: "white",
    fontWeight: "bold",
  },
  hasEvents: {
    position: "relative",
  },
  eventDot: {
    position: "absolute",
    bottom: 2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#1a8e2d",
  },
  scheduleContainer: {
    flex: 1,
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  scheduleTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#333",
  },
  medicationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  medicationColor: {
    width: 8,
    height: 40,
    borderRadius: 4,
    marginRight: 15,
  },
  medicationInfo: {
    flex: 1,
  },
  medicationName: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 3,
  },
  medicationDosage: {
    fontSize: 14,
    color: "#666",
    marginBottom: 5,
  },
  medicationTime: {
    fontSize: 14,
    color: "#666",
  },
  doseTime: {
    flexDirection: "row",
    alignItems: "center",
  },
  takenBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e8f5e9",
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  takenText: {
    color: "#4CAF50",
    marginLeft: 5,
    fontSize: 14,
  },
  takeDoseButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  takeDoseText: {
    color: "white",
    fontWeight: "bold",
  },
  emptyState: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#888",
    marginTop: 15,
    textAlign: "center",
  },
  doseList: {
    flex: 1,
  },
  missedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFEBEE",
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  missedText: {
    color: "#F44336",
    marginLeft: 5,
    fontSize: 14,
  },
  pendingButton: {
    backgroundColor: "#FFA000",
  }
});