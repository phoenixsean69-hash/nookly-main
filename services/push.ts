type PushMessage = {
  to: string
  title: string
  body: string
  data?: Record<string, any>
  sound?: 'default' | null
}

export async function sendExpoPush(message: PushMessage) {
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  })

  const result = await res.json()
  // Expo returns [{ status: 'ok', id: '...' }] or error
  if (result.data?.[0]?.status!== 'ok') {
    console.error('Push failed', result)
  }
  return result
}
