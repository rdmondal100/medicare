import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";


import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthenticaion from 'expo-local-authentication';

const { width } = Dimensions.get('window');


const AuthScreen = () => {
    const [hasBiometrics, setHasBiometrics] = useState(false)
    const [isAuthenticating, setIsAuthenticating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const checkBiometrics = async () => {
        const hasHardware = await LocalAuthenticaion.hasHardwareAsync();
        const isEnrolled = await LocalAuthenticaion.isEnrolledAsync()
        setHasBiometrics(hasHardware && isEnrolled)
    }
    useEffect(() => {
        checkBiometrics()
    }, [])

    const authenticate = async () => {
        try {
            setIsAuthenticating(true)
            setError(null)

            const hasHardware = await LocalAuthenticaion.hasHardwareAsync();
            const isEnrolled = await LocalAuthenticaion.isEnrolledAsync()
            const supportedtypes = await LocalAuthenticaion.supportedAuthenticationTypesAsync();
            console.log(hasHardware)
            console.log(isEnrolled)

            const auth = await LocalAuthenticaion.authenticateAsync({
                promptMessage: hasHardware && isEnrolled ? "Use face ID/TouchId" : "Enter Your PIN to access MediCare",
                fallbackLabel: "Use Pin",
                cancelLabel: "Cancel",
                disableDeviceFallback: false
            })

            if (auth.success) {
                router.replace('/home')
                setIsAuthenticating(false)
                return
            } else {
                setError("Authentication Failed: Please try again")
            }

        } catch (error) {
            console.log(error)
            setError("Something went wrong. Please try again.");

        } finally {
            setIsAuthenticating(false)

        }
    }

    return (
        <LinearGradient colors={['#4CAF50', '#2E7D32']} style={styles.container}>
            <View style={styles.content}>

                <View style={styles.iconContainer}>
                    <Ionicons name='medkit' size={80} color="white" />
                </View>
                <Text style={styles.title}>
                    MediCare
                </Text>
                <Text style={styles.subtitle}>
                    Your Personalized Medicine Reminer
                </Text>
                <View style={styles.card}>
                    <Text style={styles.welcomeText}>
                        Wellcome Back!
                    </Text>
                    <Text style={styles.instructionText}>
                        {hasBiometrics ? "Use face ID/TouchId or Pin to access Medicare" : 'Enter your PIN to acess Medicare'}
                    </Text>
                    <TouchableOpacity style={[styles.button, isAuthenticating && styles.buttonDisabled]}
                        onPress={authenticate}
                        disabled={isAuthenticating}
                    >
                        <Ionicons
                            style={styles.buttonIcon}
                            name={hasBiometrics ? 'finger-print-outline' : 'keypad-outline'}
                            size={24}
                            color='white'
                        />
                        <Text style={styles.buttonText}

                        >
                            {isAuthenticating ?
                                'Verifying..'
                                :
                                hasBiometrics ?
                                    'Authenticate'
                                    :
                                    'Enter PIN'}
                        </Text>

                    </TouchableOpacity>
                    {error && <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle" size={40} color="#f44336" />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>}
                </View>
            </View>
        </LinearGradient>
    )
}


export default AuthScreen


const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        padding: 20,
        justifyContent: "center",
        alignItems: "center",
    },
    iconContainer: {
        width: 120,
        height: 120,
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        borderRadius: 60,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 20,
    },
    title: {
        fontSize: 36,
        fontWeight: "bold",
        color: "white",
        marginBottom: 10,
        textShadowColor: "rgba(0, 0, 0, 0.2)",
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    subtitle: {
        fontSize: 18,
        color: "rgba(255, 255, 255, 0.9)",
        marginBottom: 40,
        textAlign: "center",
    },
    card: {
        backgroundColor: "white",
        borderRadius: 20,
        padding: 30,
        width: width - 40,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    welcomeText: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#333",
        marginBottom: 10,
    },
    instructionText: {
        fontSize: 16,
        color: "#666",
        textAlign: "center",
        marginBottom: 30,
    },
    button: {
        backgroundColor: "#4CAF50",
        paddingVertical: 15,
        paddingHorizontal: 30,
        borderRadius: 12,
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonIcon: {
        marginRight: 10,
    },
    buttonText: {
        color: "white",
        fontSize: 16,
        fontWeight: "600",
    },
    errorContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 20,
        padding: 10,
        backgroundColor: "#ffebee",
        borderRadius: 8,
    },
    errorText: {
        color: "#f44336",
        marginLeft: 8,
        fontSize: 14,
    },
});