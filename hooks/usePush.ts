import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { Platform } from 'react-native'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) return null

  const { status } = await Notifications.getPermissionsAsync()
  let finalStatus = status
  if (status !== 'granted') {
    const { status: newStatus } = await Notifications.requestPermissionsAsync()
    finalStatus = newStatus
  }
  if (finalStatus !== 'granted') return null

  const token = (await Notifications.getExpoPushTokenAsync()).data

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Nookly alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'notification.wav',
    })
  }
  return token
}

export function useNotificationListener() {
  // addNotificationResponseReceivedListener returns a Subscription
  const responseSub = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const propertyId = response.notification.request.content.data?.propertyId
      if (propertyId) {
        router.push(`/properties/${propertyId}`)
      }
    }
  )

  // optional: listen while app is foregrounded
  const receivedSub = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log('Notification received in foreground', notification)
    }
  )

  // cleanup function for useEffect
  return () => {
    responseSub.remove()
    receivedSub.remove()
  }
}
