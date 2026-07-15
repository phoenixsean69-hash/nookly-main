import { Stack } from "expo-router";

// ID for app: nookly

export default function MessagesLayout() {
  return (
    <Stack>
      <Stack.Screen name="messages" />
    </Stack>
  );
}
