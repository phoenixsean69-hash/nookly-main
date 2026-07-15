// app/(root)/calendar.tsx
import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import useAuthStore from "@/store/auth.store";
import { useNotificationStore } from "@/store/notification.store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  propertyName?: string;
  tenantName?: string;
  type: "viewing" | "maintenance" | "meeting" | "payment" | "move_in" | "other";
  status: "upcoming" | "completed" | "cancelled";
  createdAt: string;
}

// Helper function to get local date string (YYYY-MM-DD) without timezone issues
const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Parse date string to Date object without timezone issues
const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
};

// Format date for display without timezone issues
const formatDisplayDate = (dateString: string): string => {
  const date = parseLocalDate(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const STORAGE_KEY = "user_calendar_events";

export default function CalendarScreen() {
  const { user } = useAuthStore();
  const { addNotification } = useNotificationStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null,
  );
  const [modalVisible, setModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Custom toast modal states
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const toastAnim = React.useRef(new Animated.Value(0)).current;

  const slideAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    date: getLocalDateString(new Date()),
    startTime: "10:00",
    endTime: "11:00",
    type: "viewing" as CalendarEvent["type"],
    propertyName: "",
    tenantName: "",
  });

  const animateModalOpen = () => {
    slideAnim.setValue(0);
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const showToast = (message: string, type: "success" | "error") => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
    Animated.sequence([
      Animated.timing(toastAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToastVisible(false);
    });
  };

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const isLandlord = user?.userMode === "landlord";
  const userId = user?.accountId;

  // Get days in month
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }
    return days;
  };

  const days = getDaysInMonth(selectedDate);
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Get events for a specific date - FIXED: use local date string
  const getEventsForDate = (date: Date) => {
    const dateString = getLocalDateString(date);
    return events.filter((event) => event.date === dateString);
  };

  // Load events from AsyncStorage
  const loadEvents = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const storageKey = `${STORAGE_KEY}_${userId}`;
      const stored = await AsyncStorage.getItem(storageKey);
      if (stored) {
        const parsedEvents = JSON.parse(stored);
        setEvents(parsedEvents);
      } else {
        setEvents([]);
      }
    } catch (error) {
      console.error("Error loading events:", error);
      showToast("Failed to load events", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  // Save events to AsyncStorage
  const saveEvents = async (updatedEvents: CalendarEvent[]) => {
    if (!userId) return;

    try {
      const storageKey = `${STORAGE_KEY}_${userId}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(updatedEvents));
    } catch (error) {
      console.error("Error saving events:", error);
      throw error;
    }
  };

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const onRefresh = () => {
    setRefreshing(true);
    loadEvents();
  };

  const handlePreviousMonth = () => {
    setSelectedDate(
      new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1),
    );
  };

  const handleNextMonth = () => {
    setSelectedDate(
      new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1),
    );
  };

  const handleDatePress = (date: Date) => {
    setSelectedDate(date);
  };
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const handleEventPress = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setModalVisible(true);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setModalVisible(false);
    setEditModalVisible(true);
  };

  const handleUpdateEvent = async () => {
    if (!selectedEvent || !userId) return;

    try {
      setSubmitting(true);
      const updatedEvents = events.map((event) =>
        event.id === selectedEvent.id ? selectedEvent : event,
      );
      setEvents(updatedEvents);
      await saveEvents(updatedEvents);
      setEditModalVisible(false);
      showToast("Event updated successfully!", "success");
    } catch (error) {
      console.error("Error updating event:", error);
      showToast("Failed to update event", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent || !userId) return;

    // Show confirmation modal instead of alert
    Alert.alert("Delete Event", "Are you sure you want to delete this event?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setSubmitting(true);
            const updatedEvents = events.filter(
              (event) => event.id !== selectedEvent.id,
            );
            setEvents(updatedEvents);
            await saveEvents(updatedEvents);

            // Add notification for deletion
            await addNotification(userId, {
              title: "🗑️ Event Deleted",
              message: `Event "${selectedEvent.title}" has been deleted from your calendar.`,
              type: "alert",
              eventId: selectedEvent.id,
            });

            setModalVisible(false);
            showToast("Event deleted successfully!", "success");
          } catch (error) {
            console.error("Error deleting event:", error);
            showToast("Failed to delete event", "error");
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  const handleStatusChange = async (newStatus: CalendarEvent["status"]) => {
    if (!selectedEvent || !userId) return;

    try {
      setSubmitting(true);
      const updatedEvents = events.map((event) =>
        event.id === selectedEvent.id ? { ...event, status: newStatus } : event,
      );
      setEvents(updatedEvents);
      await saveEvents(updatedEvents);

      // Add notification for status change
      const statusMessage =
        newStatus === "completed" ? "completed" : "cancelled";
      await addNotification(userId, {
        title: `✅ Event ${statusMessage.charAt(0).toUpperCase() + statusMessage.slice(1)}`,
        message: `"${selectedEvent.title}" has been marked as ${statusMessage}.`,
        type: "event",
        eventId: selectedEvent.id,
        eventDate: selectedEvent.date,
      });

      setModalVisible(false);
      showToast(`Event marked as ${newStatus}!`, "success");
    } catch (error) {
      console.error("Error updating status:", error);
      showToast("Failed to update event status", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddEvent = async () => {
    if (!newEvent.title.trim() || !userId) {
      showToast("Please enter an event title", "error");
      return;
    }

    try {
      setSubmitting(true);
      const newEventObj: CalendarEvent = {
        id: Date.now().toString(),
        title: newEvent.title,
        description: newEvent.description,
        date: newEvent.date, // Already in local format YYYY-MM-DD
        startTime: newEvent.startTime,
        endTime: newEvent.endTime,
        propertyName: newEvent.propertyName,
        tenantName: newEvent.tenantName,
        type: newEvent.type,
        status: "upcoming",
        createdAt: new Date().toISOString(),
      };

      const updatedEvents = [...events, newEventObj];
      setEvents(updatedEvents);
      await saveEvents(updatedEvents);

      // Add notification for the new event - FIXED: use parseLocalDate
      const eventDate = parseLocalDate(newEvent.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil(
        (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      let message = "";
      if (newEvent.type === "viewing") {
        message = `You have a property viewing scheduled for ${newEvent.date} at ${newEvent.startTime}`;
        if (newEvent.propertyName) message += ` at ${newEvent.propertyName}`;
      } else if (newEvent.type === "maintenance") {
        message = `Maintenance scheduled for ${newEvent.date} at ${newEvent.startTime}`;
        if (newEvent.propertyName) message += ` at ${newEvent.propertyName}`;
      } else if (newEvent.type === "payment") {
        message = `Rent payment reminder for ${newEvent.date}`;
        if (newEvent.propertyName) message += ` - ${newEvent.propertyName}`;
      } else if (newEvent.type === "move_in") {
        message = `Move-in date scheduled for ${newEvent.date} at ${newEvent.startTime}`;
        if (newEvent.propertyName) message += ` at ${newEvent.propertyName}`;
      } else if (newEvent.type === "meeting") {
        message = `Meeting scheduled for ${newEvent.date} at ${newEvent.startTime}`;
        if (newEvent.tenantName) message += ` with ${newEvent.tenantName}`;
      } else {
        message = `${newEvent.title} on ${newEvent.date} at ${newEvent.startTime}`;
      }

      // Add reminder message if the event is soon
      if (daysUntil === 0) {
        message = `⚠️ TODAY: ${message}`;
      } else if (daysUntil === 1) {
        message = `📅 TOMORROW: ${message}`;
      }

      await addNotification(userId, {
        title: `📅 ${newEvent.type === "payment" ? "Payment Reminder" : "New Event"}: ${newEvent.title}`,
        message: message,
        type: "event",
        eventId: newEventObj.id,
        eventDate: newEvent.date,
      });

      setAddModalVisible(false);
      // Reset form - FIXED: use getLocalDateString
      setNewEvent({
        title: "",
        description: "",
        date: getLocalDateString(new Date()),
        startTime: "10:00",
        endTime: "11:00",
        type: "viewing",
        propertyName: "",
        tenantName: "",
      });

      showToast("Event added successfully!", "success");
    } catch (error) {
      console.error("Error adding event:", error);
      showToast("Failed to add event", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case "viewing":
        return icons.eye;
      case "maintenance":
        return icons.edit;
      case "meeting":
        return icons.chat;
      case "payment":
        return icons.wallet;
      case "move_in":
        return icons.house;
      default:
        return icons.calendar;
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case "viewing":
        return "#3B82F6";
      case "maintenance":
        return "#F59E0B";
      case "meeting":
        return "#8B5CF6";
      case "payment":
        return "#10B981";
      case "move_in":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case "viewing":
        return "Viewing";
      case "maintenance":
        return "Maintenance";
      case "meeting":
        return "Meeting";
      case "payment":
        return "Payment";
      case "move_in":
        return "Move-in";
      default:
        return "Other";
    }
  };

  const renderToast = () => (
    <Animated.View
      style={{
        position: "absolute",
        bottom: 30,
        left: 20,
        right: 20,
        transform: [
          {
            translateY: toastAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [100, 0],
            }),
          },
        ],
        zIndex: 1000,
      }}
    >
      <View
        className="rounded-xl p-4 flex-row items-center mx-4"
        style={{
          backgroundColor: toastType === "success" ? "#10B981" : "#EF4444",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
        }}
      >
        <Image
          source={toastType === "success" ? icons.check : icons.close}
          className="w-6 h-6 mr-3"
          style={{ tintColor: "#FFFFFF" }}
        />
        <Text className="flex-1 text-white font-rubik-medium text-base">
          {toastMessage}
        </Text>
      </View>
    </Animated.View>
  );

  const renderEventModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={modalVisible}
      onRequestClose={() => setModalVisible(false)}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View
          className="rounded-t-3xl p-6"
          style={{ backgroundColor: theme.background }}
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text
              className="text-xl font-rubik-bold"
              style={{ color: theme.title }}
            >
              Event Details
            </Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text className="text-2xl" style={{ color: theme.text }}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          {selectedEvent && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="mb-4">
                <View
                  className="px-3 py-1 rounded-full self-start mb-3"
                  style={{
                    backgroundColor:
                      getEventTypeColor(selectedEvent.type) + "20",
                  }}
                >
                  <Text
                    className="text-xs font-rubik-medium"
                    style={{ color: getEventTypeColor(selectedEvent.type) }}
                  >
                    {getEventTypeLabel(selectedEvent.type)}
                  </Text>
                </View>
                <Text
                  className="text-xl font-rubik-bold"
                  style={{ color: theme.text }}
                >
                  {selectedEvent.title}
                </Text>
              </View>

              <View className="mb-4">
                <Text
                  className="text-sm font-rubik-medium mb-2"
                  style={{ color: theme.muted }}
                >
                  Date & Time
                </Text>
                <View className="flex-row items-center">
                  <Image
                    source={icons.calendar}
                    className="w-5 h-5"
                    style={{ tintColor: theme.muted }}
                  />
                  <Text
                    className="ml-2 text-base"
                    style={{ color: theme.text }}
                  >
                    {formatDisplayDate(selectedEvent.date)}
                  </Text>
                </View>
                <View className="flex-row items-center mt-2">
                  <Image
                    source={icons.clock}
                    className="w-5 h-5"
                    style={{ tintColor: theme.muted }}
                  />
                  <Text
                    className="ml-2 text-base"
                    style={{ color: theme.text }}
                  >
                    {selectedEvent.startTime} - {selectedEvent.endTime}
                  </Text>
                </View>
              </View>

              {selectedEvent.propertyName && (
                <View className="mb-4">
                  <Text
                    className="text-sm font-rubik-medium mb-2"
                    style={{ color: theme.muted }}
                  >
                    Property
                  </Text>
                  <View className="flex-row items-center">
                    <Image
                      source={icons.house}
                      className="w-5 h-5"
                      style={{ tintColor: theme.muted }}
                    />
                    <Text
                      className="ml-2 text-base"
                      style={{ color: theme.text }}
                    >
                      {selectedEvent.propertyName}
                    </Text>
                  </View>
                </View>
              )}

              {selectedEvent.tenantName && isLandlord && (
                <View className="mb-4">
                  <Text
                    className="text-sm font-rubik-medium mb-2"
                    style={{ color: theme.muted }}
                  >
                    Tenant
                  </Text>
                  <View className="flex-row items-center">
                    <Image
                      source={icons.person}
                      className="w-5 h-5"
                      style={{ tintColor: theme.muted }}
                    />
                    <Text
                      className="ml-2 text-base"
                      style={{ color: theme.text }}
                    >
                      {selectedEvent.tenantName}
                    </Text>
                  </View>
                </View>
              )}

              {selectedEvent.description && (
                <View className="mb-4">
                  <Text
                    className="text-sm font-rubik-medium mb-2"
                    style={{ color: theme.muted }}
                  >
                    Description
                  </Text>
                  <Text className="text-base" style={{ color: theme.text }}>
                    {selectedEvent.description}
                  </Text>
                </View>
              )}

              <View className="flex-row gap-3 mt-4 mb-4">
                <TouchableOpacity
                  onPress={() => handleEditEvent(selectedEvent)}
                  className="flex-1 py-3 rounded-full border border-primary-300"
                  style={{ backgroundColor: theme.primary[100] }}
                >
                  <Text className="text-center font-rubik-medium text-primary-600">
                    Edit
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDeleteEvent}
                  className="flex-1 py-3 rounded-full border border-red-500"
                  style={{ backgroundColor: theme.danger + "10" }}
                >
                  <Text className="text-center font-rubik-medium text-red-500">
                    Delete
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="flex-row gap-3 mb-6">
                {selectedEvent.status === "upcoming" && (
                  <>
                    <TouchableOpacity
                      onPress={() => handleStatusChange("completed")}
                      className="flex-1 py-3 rounded-full bg-green-500"
                    >
                      <Text className="text-white text-center font-rubik-medium">
                        Mark Complete
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleStatusChange("cancelled")}
                      className="flex-1 py-3 rounded-full bg-red-500"
                    >
                      <Text className="text-white text-center font-rubik-medium">
                        Cancel Event
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderEditModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={editModalVisible}
      onRequestClose={() => setEditModalVisible(false)}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View
          className="rounded-t-3xl p-6"
          style={{ backgroundColor: theme.background }}
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text
              className="text-xl font-rubik-bold"
              style={{ color: theme.title }}
            >
              Edit Event
            </Text>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <Text className="text-2xl" style={{ color: theme.text }}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          {selectedEvent && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="mb-4">
                <Text
                  className="text-sm font-rubik-medium mb-1"
                  style={{ color: theme.muted }}
                >
                  Title
                </Text>
                <TextInput
                  value={selectedEvent.title}
                  onChangeText={(text) =>
                    setSelectedEvent({ ...selectedEvent, title: text })
                  }
                  className="border rounded-lg px-4 py-3"
                  style={{
                    backgroundColor: theme.surface,
                    borderColor: theme.muted + "50",
                    color: theme.text,
                  }}
                />
              </View>

              <View className="mb-4">
                <Text
                  className="text-sm font-rubik-medium mb-1"
                  style={{ color: theme.muted }}
                >
                  Date
                </Text>
                <TextInput
                  value={selectedEvent.date}
                  onChangeText={(text) =>
                    setSelectedEvent({ ...selectedEvent, date: text })
                  }
                  className="border rounded-lg px-4 py-3"
                  style={{
                    backgroundColor: theme.surface,
                    borderColor: theme.muted + "50",
                    color: theme.text,
                  }}
                  placeholder="YYYY-MM-DD"
                />
              </View>

              <View className="flex-row gap-4 mb-4">
                <View className="flex-1">
                  <Text
                    className="text-sm font-rubik-medium mb-1"
                    style={{ color: theme.muted }}
                  >
                    Start Time
                  </Text>
                  <TextInput
                    value={selectedEvent.startTime}
                    onChangeText={(text) =>
                      setSelectedEvent({ ...selectedEvent, startTime: text })
                    }
                    className="border rounded-lg px-4 py-3"
                    style={{
                      backgroundColor: theme.surface,
                      borderColor: theme.muted + "50",
                      color: theme.text,
                    }}
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className="text-sm font-rubik-medium mb-1"
                    style={{ color: theme.muted }}
                  >
                    End Time
                  </Text>
                  <TextInput
                    value={selectedEvent.endTime}
                    onChangeText={(text) =>
                      setSelectedEvent({ ...selectedEvent, endTime: text })
                    }
                    className="border rounded-lg px-4 py-3"
                    style={{
                      backgroundColor: theme.surface,
                      borderColor: theme.muted + "50",
                      color: theme.text,
                    }}
                  />
                </View>
              </View>

              <View className="mb-4">
                <Text
                  className="text-sm font-rubik-medium mb-1"
                  style={{ color: theme.muted }}
                >
                  Description
                </Text>
                <TextInput
                  value={selectedEvent.description}
                  onChangeText={(text) =>
                    setSelectedEvent({ ...selectedEvent, description: text })
                  }
                  className="border rounded-lg px-4 py-3 h-24"
                  style={{
                    backgroundColor: theme.surface,
                    borderColor: theme.muted + "50",
                    color: theme.text,
                  }}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              <View className="flex-row gap-3 mt-4 mb-10">
                <TouchableOpacity
                  onPress={() => setEditModalVisible(false)}
                  className="flex-1 py-3 rounded-full border"
                  style={{ borderColor: theme.muted + "50" }}
                >
                  <Text
                    className="text-center font-rubik-medium"
                    style={{ color: theme.text }}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleUpdateEvent}
                  disabled={submitting}
                  className="flex-1 py-3 rounded-full bg-primary-300"
                >
                  <Text className="text-white text-center font-rubik-medium">
                    {submitting ? "Saving..." : "Save Changes"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderAddEventModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={addModalVisible}
      onRequestClose={() => setAddModalVisible(false)}
      onShow={() => animateModalOpen()}
    >
      <View className="flex-1 justify-end bg-black/50">
        <Animated.View
          style={{
            transform: [
              {
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [600, 0],
                }),
              },
            ],
          }}
        >
          <View
            className="rounded-t-3xl p-6"
            style={{ backgroundColor: theme.background }}
          >
            <View className="flex-row justify-between items-center mb-4">
              <Text
                className="text-xl font-rubik-bold"
                style={{ color: theme.title }}
              >
                ✨ Add New Event
              </Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Text className="text-2xl" style={{ color: theme.text }}>
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Title with icon */}
              <View className="mb-4">
                <Text
                  className="text-sm font-rubik-medium mb-1"
                  style={{ color: theme.muted }}
                >
                  📝 Title *
                </Text>
                <TextInput
                  value={newEvent.title}
                  onChangeText={(text) =>
                    setNewEvent({ ...newEvent, title: text })
                  }
                  className="border rounded-lg px-4 py-3"
                  style={{
                    backgroundColor: theme.surface,
                    borderColor: theme.muted + "50",
                    color: theme.text,
                  }}
                  placeholder="e.g., Property Viewing"
                  placeholderTextColor={theme.muted}
                />
              </View>

              {/* Event Type - Animated selection */}
              <View className="mb-4">
                <Text
                  className="text-sm font-rubik-medium mb-2"
                  style={{ color: theme.muted }}
                >
                  🏷️ Event Type
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {[
                    { value: "viewing", label: "🔍 Viewing", color: "#3B82F6" },
                    {
                      value: "maintenance",
                      label: "🔧 Maintenance",
                      color: "#F59E0B",
                    },
                    { value: "meeting", label: "🤝 Meeting", color: "#8B5CF6" },
                    { value: "payment", label: "💰 Payment", color: "#10B981" },
                    { value: "move_in", label: "📦 Move-in", color: "#EF4444" },
                    { value: "other", label: "📌 Other", color: "#6B7280" },
                  ].map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      onPress={() => {
                        Animated.sequence([
                          Animated.timing(scaleAnim, {
                            toValue: 0.95,
                            duration: 50,
                            useNativeDriver: true,
                          }),
                          Animated.spring(scaleAnim, {
                            toValue: 1,
                            useNativeDriver: true,
                            tension: 200,
                            friction: 10,
                          }),
                        ]).start();
                        setNewEvent({
                          ...newEvent,
                          type: type.value as CalendarEvent["type"],
                        });
                      }}
                      className={`px-4 py-2 rounded-full mr-2`}
                      style={{
                        transform: [{ scale: scaleAnim }],
                        backgroundColor:
                          newEvent.type === type.value
                            ? type.color
                            : theme.surface,
                        borderWidth: 1,
                        borderColor: theme.muted + "50",
                      }}
                    >
                      <Text
                        className="text-sm font-rubik-medium"
                        style={{
                          color:
                            newEvent.type === type.value ? "white" : theme.text,
                        }}
                      >
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Date with Calendar Picker - FIXED display */}
              <View className="mb-4">
                <Text
                  className="text-sm font-rubik-medium mb-1"
                  style={{ color: theme.muted }}
                >
                  📅 Date
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setTempDate(parseLocalDate(newEvent.date));
                    setShowDatePicker(true);
                  }}
                  className="border rounded-lg px-4 py-3 flex-row items-center justify-between"
                  style={{
                    backgroundColor: theme.surface,
                    borderColor: theme.muted + "50",
                  }}
                >
                  <View className="flex-row items-center">
                    <Text className="text-lg mr-2">📅</Text>
                    <Text style={{ color: theme.text, fontSize: 16 }}>
                      {formatDisplayDate(newEvent.date)}
                    </Text>
                  </View>
                  <Text style={{ color: theme.primary[300], fontSize: 14 }}>
                    Change
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Time row */}
              <View className="flex-row gap-4 mb-4">
                <View className="flex-1">
                  <Text
                    className="text-sm font-rubik-medium mb-1"
                    style={{ color: theme.muted }}
                  >
                    ⏰ Start Time
                  </Text>
                  <TextInput
                    value={newEvent.startTime}
                    onChangeText={(text) =>
                      setNewEvent({ ...newEvent, startTime: text })
                    }
                    className="border rounded-lg px-4 py-3"
                    style={{
                      backgroundColor: theme.surface,
                      borderColor: theme.muted + "50",
                      color: theme.text,
                    }}
                    placeholder="09:00"
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className="text-sm font-rubik-medium mb-1"
                    style={{ color: theme.muted }}
                  >
                    ⏰ End Time
                  </Text>
                  <TextInput
                    value={newEvent.endTime}
                    onChangeText={(text) =>
                      setNewEvent({ ...newEvent, endTime: text })
                    }
                    className="border rounded-lg px-4 py-3"
                    style={{
                      backgroundColor: theme.surface,
                      borderColor: theme.muted + "50",
                      color: theme.text,
                    }}
                    placeholder="10:00"
                  />
                </View>
              </View>

              {/* Property Name */}
              <View className="mb-4">
                <Text
                  className="text-sm font-rubik-medium mb-1"
                  style={{ color: theme.muted }}
                >
                  🏠 Property Name (Optional)
                </Text>
                <TextInput
                  value={newEvent.propertyName}
                  onChangeText={(text) =>
                    setNewEvent({ ...newEvent, propertyName: text })
                  }
                  className="border rounded-lg px-4 py-3"
                  style={{
                    backgroundColor: theme.surface,
                    borderColor: theme.muted + "50",
                    color: theme.text,
                  }}
                  placeholder="e.g., Sunset Villa"
                  placeholderTextColor={theme.muted}
                />
              </View>

              {/* Tenant Name - Only for landlords */}
              {isLandlord && (
                <View className="mb-4">
                  <Text
                    className="text-sm font-rubik-medium mb-1"
                    style={{ color: theme.muted }}
                  >
                    👤 Tenant Name (Optional)
                  </Text>
                  <TextInput
                    value={newEvent.tenantName}
                    onChangeText={(text) =>
                      setNewEvent({ ...newEvent, tenantName: text })
                    }
                    className="border rounded-lg px-4 py-3"
                    style={{
                      backgroundColor: theme.surface,
                      borderColor: theme.muted + "50",
                      color: theme.text,
                    }}
                    placeholder="Tenant name"
                    placeholderTextColor={theme.muted}
                  />
                </View>
              )}

              {/* Description */}
              <View className="mb-4">
                <Text
                  className="text-sm font-rubik-medium mb-1"
                  style={{ color: theme.muted }}
                >
                  📝 Description (Optional)
                </Text>
                <TextInput
                  value={newEvent.description}
                  onChangeText={(text) =>
                    setNewEvent({ ...newEvent, description: text })
                  }
                  className="border rounded-lg px-4 py-3 h-24"
                  style={{
                    backgroundColor: theme.surface,
                    borderColor: theme.muted + "50",
                    color: theme.title,
                  }}
                  multiline
                  textAlignVertical="top"
                  placeholder="Add details..."
                />
              </View>

              {/* Animated Buttons */}
              <View className="flex-row gap-3 mt-4 mb-10">
                <TouchableOpacity
                  onPress={() => setAddModalVisible(false)}
                  className="flex-1 py-3 rounded-full border"
                  style={{ borderColor: theme.muted + "50" }}
                >
                  <Text
                    className="text-center font-rubik-medium"
                    style={{ color: theme.text }}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleAddEvent}
                  disabled={submitting}
                  className="flex-1 py-3 rounded-full bg-primary-300"
                  style={{
                    opacity: submitting ? 0.6 : 1,
                  }}
                >
                  <Text className="text-white text-center font-rubik-medium">
                    {submitting ? "✨ Adding..." : "✨ Add Event"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View
        className="flex-row items-center px-5 py-4 border-b"
        style={{ borderBottomColor: theme.muted + "30" }}
      >
        <TouchableOpacity
          onPress={() => router.push(isLandlord ? "/landHome" : "/tenantHome")}
          className="mr-4 p-2"
        >
          <Image
            source={icons.backArrow}
            className="w-6 h-6"
            style={{ tintColor: theme.text }}
          />
        </TouchableOpacity>
        <Text
          className="text-2xl font-rubik-bold flex-1"
          style={{ color: theme.title }}
        >
          My Calendar
        </Text>
        <TouchableOpacity
          onPress={() => setAddModalVisible(true)}
          className="p-2"
        >
          <Image
            source={icons.plus}
            className="w-6 h-6"
            style={{ tintColor: theme.primary[300] }}
          />
        </TouchableOpacity>
      </View>

      {/* Calendar Header */}
      <View className="flex-row items-center justify-between px-5 py-4">
        <TouchableOpacity onPress={handlePreviousMonth} className="p-2">
          <Image
            source={icons.backArrow}
            className="w-5 h-5"
            style={{ tintColor: theme.text }}
          />
        </TouchableOpacity>
        <Text
          className="text-lg font-rubik-bold"
          style={{ color: theme.title }}
        >
          {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
        </Text>
        <TouchableOpacity onPress={handleNextMonth} className="p-2">
          <Image
            source={icons.rightArrow}
            className="w-5 h-5"
            style={{ tintColor: theme.text }}
          />
        </TouchableOpacity>
      </View>

      {/* Week Days Header */}
      <View className="flex-row px-2 mb-2">
        {weekDays.map((day, index) => (
          <View key={index} className="flex-1 items-center py-2">
            <Text
              className="text-sm font-rubik-medium"
              style={{ color: theme.muted }}
            >
              {day}
            </Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View className="px-2">
        {Array.from({ length: Math.ceil(days.length / 7) }).map(
          (_, weekIndex) => (
            <View key={weekIndex} className="flex-row">
              {days
                .slice(weekIndex * 7, (weekIndex + 1) * 7)
                .map((day, dayIndex) => {
                  const dayEvents = getEventsForDate(day.date);
                  const isToday =
                    getLocalDateString(day.date) ===
                    getLocalDateString(new Date());
                  const isSelected =
                    getLocalDateString(day.date) ===
                    getLocalDateString(selectedDate);

                  return (
                    <TouchableOpacity
                      key={dayIndex}
                      onPress={() => handleDatePress(day.date)}
                      className="flex-1 items-center py-3 mx-1 rounded-lg"
                      style={{
                        backgroundColor: isSelected
                          ? theme.primary[100]
                          : "transparent",
                        borderWidth: isToday ? 1 : 0,
                        borderColor: theme.primary[300],
                      }}
                    >
                      <Text
                        className={`text-base ${!day.isCurrentMonth ? "opacity-40" : ""}`}
                        style={{ color: theme.text }}
                      >
                        {day.date.getDate()}
                      </Text>
                      {dayEvents.length > 0 && (
                        <View className="flex-row gap-1 mt-1">
                          {dayEvents.slice(0, 3).map((_, idx) => (
                            <View
                              key={idx}
                              className="w-1.5 h-1.5 rounded-full"
                              style={{
                                backgroundColor: getEventTypeColor(
                                  dayEvents[idx].type,
                                ),
                              }}
                            />
                          ))}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
            </View>
          ),
        )}
      </View>

      {/* Events for Selected Date */}
      <View className="flex-1 mt-4 px-5">
        <Text
          className="text-lg font-rubik-bold mb-3"
          style={{ color: theme.title }}
        >
          {selectedDate.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
          })}
        </Text>

        {loading ? (
          <View className="items-center justify-center py-10">
            <ActivityIndicator size="large" color={theme.primary[300]} />
          </View>
        ) : getEventsForDate(selectedDate).length === 0 ? (
          <View className="items-center py-10">
            <Image
              source={icons.calendar}
              className="w-16 h-16 opacity-30 mb-4"
              style={{ tintColor: theme.muted }}
            />
            <Text className="text-center mb-2" style={{ color: theme.muted }}>
              No events for this day
            </Text>
            <Text
              className="text-center text-sm"
              style={{ color: theme.muted }}
            >
              Tap the + button to add a{" "}
              {isLandlord
                ? "viewing, maintenance, or meeting"
                : "viewing, payment reminder, or move-in date"}
            </Text>
            <TouchableOpacity
              onPress={() => setAddModalVisible(true)}
              className="mt-4 px-6 py-2 rounded-full bg-primary-300"
            >
              <Text className="text-white font-rubik-medium">Add Event</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[theme.primary[300]]}
                tintColor={theme.primary[300]}
              />
            }
          >
            {getEventsForDate(selectedDate).map((event) => (
              <TouchableOpacity
                key={event.id}
                onPress={() => handleEventPress(event)}
                className="p-4 rounded-xl mb-3"
                style={{
                  backgroundColor: theme.surface,
                  borderWidth: 1,
                  borderColor: theme.muted + "30",
                }}
              >
                <View className="flex-row items-center">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{
                      backgroundColor: getEventTypeColor(event.type) + "20",
                    }}
                  >
                    <Image
                      source={getEventTypeIcon(event.type)}
                      className="w-5 h-5"
                      style={{ tintColor: getEventTypeColor(event.type) }}
                    />
                  </View>
                  <View className="flex-1">
                    <Text
                      className="font-rubik-bold"
                      style={{ color: theme.text }}
                    >
                      {event.title}
                    </Text>
                    <Text
                      className="text-xs mt-1"
                      style={{ color: theme.muted }}
                    >
                      {event.startTime} - {event.endTime}
                    </Text>
                    {event.propertyName && (
                      <Text
                        className="text-xs mt-1"
                        style={{ color: theme.muted }}
                      >
                        {event.propertyName}
                      </Text>
                    )}
                    {event.tenantName && isLandlord && (
                      <Text
                        className="text-xs mt-1"
                        style={{ color: theme.muted }}
                      >
                        With: {event.tenantName}
                      </Text>
                    )}
                  </View>
                  <View
                    className={`px-2 py-1 rounded-full ${event.status === "upcoming" ? "bg-green-500/20" : "bg-gray-500/20"}`}
                  >
                    <Text
                      className="text-xs capitalize"
                      style={{
                        color:
                          event.status === "upcoming" ? "#10B981" : theme.muted,
                      }}
                    >
                      {event.status}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Modals */}
      {renderEventModal()}
      {renderAddEventModal()}
      {renderEditModal()}
      {renderToast()}

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (date) {
              const dateString = getLocalDateString(date);
              setNewEvent({ ...newEvent, date: dateString });
            }
          }}
        />
      )}
    </SafeAreaView>
  );
}
