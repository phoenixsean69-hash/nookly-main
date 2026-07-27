// app/_layout.tsx
import { AuthProvider } from "@/context/AuthContext"
import notificationService from "@/services/notification.service"
import useAuthStore from "@/store/auth.store"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useFonts } from "expo-font"
import * as Notifications from "expo-notifications"
import { router, Slot } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { useEffect, useRef, useState } from "react"
import { LogBox, Platform } from "react-native"
import "./global.css"

LogBox.ignoreLogs(["JSON Parse error", "Error parsing reviews", "Setting a timer"])

if (!__DEV__) LogBox.ignoreAllLogs()

// One handler for the whole app
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Rubik-Bold": require("../assets/fonts/Rubik-Bold.ttf"),
    "Rubik-ExtraBold": require("../assets/fonts/Rubik-ExtraBold.ttf"),
    "Rubik-Light": require("../assets/fonts/Rubik-Light.ttf"),
    "Rubik-Medium": require("../assets/fonts/Rubik-Medium.ttf"),
    "Rubik-Regular": require("../assets/fonts/Rubik-Regular.ttf"),
    "Rubik-SemiBold": require("../assets/fonts/Rubik-SemiBold.ttf"),
  })

  const { user, hydrate } = useAuthStore()
  const notificationListener = useRef<Notifications.Subscription>(null)
  const responseListener = useRef<Notifications.Subscription>(null)
  const [appIsReady, setAppIsReady] = useState(false)
  const prevUserId = useRef<string | null>(null)

  // Init
  useEffect(() => {
    const init = async () => {
      await hydrate()
      setAppIsReady(true)
    }
    init()
  }, [hydrate])

  useEffect(() => {
    if (fontsLoaded && appIsReady) SplashScreen.hideAsync()
  }, [fontsLoaded, appIsReady])

  // Android channel
  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Nookly alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'notification.wav',
      })
    }
  }, [])

  // Register push when logged in
  useEffect(() => {
    const register = async () => {
      if (!user?.accountId) return
      prevUserId.current = user.accountId

      const pushEnabled = await AsyncStorage.getItem('push_notifications_enabled')
      if (pushEnabled === 'false') return

      try {
        const token = await notificationService.registerForPushNotificationsAsync(user.accountId)
        if (token) console.log('Push registered')
      } catch (e) {
        console.error('Push registration error:', e)
      }
    }
    register()
  }, [user?.accountId])

  // Deactivate on logout
  useEffect(() => {
    const cleanup = async () => {
      if (!prevUserId.current || user) return
      const token = notificationService.getExpoPushToken?.()
      if (token) {
        await notificationService.deactivatePushToken(prevUserId.current, token)
        console.log('Push token deactivated')
      }
      prevUserId.current = null
    }
    cleanup()
  }, [user])

  // Listeners
  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener((n) => {
      console.log('Foreground notification:', n.request.content.title)
    })

responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
  const data = response.notification.request.content.data as {
    type?: string
    screen?: string
    propertyId?: string
  }
  const { user } = useAuthStore.getState()
  const home = user?.userMode === 'landlord' ? '/landHome' : '/tenantHome'

  if (!data?.type && !data?.screen) return router.push(home)

  switch (data.type) {
    case 'match': 
      router.push('/match')
      break
    case 'request':
      router.push('/Landrequests')
      break
    case 'property':
      router.push('/explore')
      break
    case 'request_response':
      router.push('/tenantHome')
      break
    case 'alert':
      router.push(home)
      break
    default:
      if (typeof data.screen === 'string') {
        // dynamic route from server, bypass typed check
        router.push(data.screen as any)
      } else {
        router.push(home)
      }
  }
})


    return () => {
      notificationListener.current?.remove()
      responseListener.current?.remove()
    }
  }, [])

  if (!fontsLoaded ||!appIsReady) return null

  return (
    <AuthProvider>
      <Slot />
    </AuthProvider>
  )
}
