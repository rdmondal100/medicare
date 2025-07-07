import AsyncStorage from "@react-native-async-storage/async-storage";

const MEDICATIONS_KEY = "@medications";
const DOSE_HISTORY_KEY = "@dose_history";

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  times: string[];
  startDate: string;
  duration: string;
  color: string;
  reminderEnabled: boolean;
  currentSupply: number;
  totalSupply: number;
  refillAt: number;
  refillReminder: boolean;
  lastRefillDate?: string;
}

export interface DoseHistory {
  id: string;
  medicationId: string;
  timestamp: string;
  taken: boolean;
  scheduledTime?: string;
}

export async function getMedications(): Promise<Medication[]> {
  try {
    const data = await AsyncStorage.getItem(MEDICATIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Error getting medications:", error);
    return [];
  }
}

export async function addMedication(medication: Medication): Promise<void> {
  try {
    const medications = await getMedications();
    medications.push(medication);
    await AsyncStorage.setItem(MEDICATIONS_KEY, JSON.stringify(medications));
  } catch (error) {
    console.error("Error adding medication:", error);
    throw error;
  }
}

export async function updateMedication(updatedMedication: Medication): Promise<void> {
  try {
    const medications = await getMedications();
    const index = medications.findIndex((med) => med.id === updatedMedication.id);
    if (index !== -1) {
      medications[index] = updatedMedication;
      await AsyncStorage.setItem(MEDICATIONS_KEY, JSON.stringify(medications));
    }
  } catch (error) {
    console.error("Error updating medication:", error);
    throw error;
  }
}

export async function deleteMedication(id: string): Promise<void> {
  try {
    const medications = await getMedications();
    const updatedMedications = medications.filter((med) => med.id !== id);
    await AsyncStorage.setItem(MEDICATIONS_KEY, JSON.stringify(updatedMedications));
  } catch (error) {
    console.error("Error deleting medication:", error);
    throw error;
  }
}

export async function getDoseHistory(): Promise<DoseHistory[]> {
  try {
    const data = await AsyncStorage.getItem(DOSE_HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Error getting dose history:", error);
    return [];
  }
}

export async function getTodaysDoses(): Promise<DoseHistory[]> {
  try {
    const history = await getDoseHistory();
    const today = new Date().toDateString();
    return history.filter(
      (dose) => new Date(dose.timestamp).toDateString() === today
    );
  } catch (error) {
    console.error("Error getting today's doses:", error);
    return [];
  }
}

export async function recordDose(
  medicationId: string,
  taken: boolean,
  timestamp: string,
  scheduledTime?: string
): Promise<void> {
  try {
    const history = await getDoseHistory();
    
    const newDose: DoseHistory = {
      id: Math.random().toString(36).substr(2, 9),
      medicationId,
      timestamp,
      taken,
      scheduledTime
    };

    history.push(newDose);
    await AsyncStorage.setItem(DOSE_HISTORY_KEY, JSON.stringify(history));

    if (taken) {
      const medications = await getMedications();
      const medication = medications.find(med => med.id === medicationId);
      if (medication && medication.currentSupply > 0) {
        medication.currentSupply -= 1;
        await updateMedication(medication);
      }
    }
  } catch (error) {
    console.error("Error recording dose:", error);
    throw error;
  }
}

export async function checkMissedDoses() {
  try {
    const [medications, history] = await Promise.all([
      getMedications(),
      getDoseHistory()
    ]);
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    for (const medication of medications) {
      for (const time of medication.times) {
        const [hours, minutes] = time.split(':').map(Number);
        const scheduledTime = new Date(today);
        scheduledTime.setHours(hours, minutes, 0, 0);
        
        if (scheduledTime > now) continue;
        
        const exists = history.some(dose => 
          dose.medicationId === medication.id && 
          dose.scheduledTime === scheduledTime.toISOString()
        );
        
        if (!exists) {
          const graceEnd = new Date(scheduledTime.getTime() + 10 * 60000);
          
          if (now > graceEnd) {
            await recordDose(
              medication.id, 
              false, 
              graceEnd.toISOString(),
              scheduledTime.toISOString()
            );
          }
        }
      }
    }
  } catch (error) {
    console.error("Error checking missed doses:", error);
  }
}

export async function clearAllData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([MEDICATIONS_KEY, DOSE_HISTORY_KEY]);
  } catch (error) {
    console.error("Error clearing data:", error);
    throw error;
  }
}

 export function getDoseStatus(
  scheduledTime: string, 
  doses: DoseHistory[], 
  gracePeriodMinutes: number,
  currentTime: Date = new Date()  // Add current time parameter
): 'taken' | 'missed' | 'pending' | 'upcoming' {
  const scheduled = new Date(scheduledTime);
  const gracePeriodMs = gracePeriodMinutes * 60 * 1000;
  
  // Check if taken
  const isTaken = doses.some(dose => {
    const takenTime = new Date(dose.timestamp);
    return takenTime >= scheduled;
  });

  if (isTaken) return 'taken';

  const timeDiff = currentTime.getTime() - scheduled.getTime();
  
  // If we're in the grace period after scheduled time
  if (timeDiff >= 0 && timeDiff <= gracePeriodMs) {
    return 'pending';
  }
  
  // If we're past the grace period but still today
  if (timeDiff > gracePeriodMs && isSameDay(currentTime, scheduled)) {
    return 'missed';
  }
  
  // If scheduled time is in the future
  return 'upcoming';
}

// Helper function to check if two dates are the same day
function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

// Add to storage.ts
export async function markDoseAsMissed(medicationId: string) {
  // Implement logic to mark dose as missed
  console.log(`Marking dose as missed for medication ${medicationId}`);
}