// components/QuickActions.tsx
import icons from "@/constants/icons";
import { isStudentTenant } from "@/lib/userMode";
import useAuthStore from "@/store/auth.store";
import { router } from "expo-router";
import React from "react";
import {
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type QuickAction = {
  label: string;
  icon: any;
  tintColor?: string;
  route: string;
  nonStudentRoute?: string;
};

const actions: QuickAction[] = [
  {
    label: "Favorites",
    icon: icons.heart,
    tintColor: "#EF4444",
    route: "/my-favorites",
  },
  {
    label: "Landlords",
    icon: icons.owner,
    route: "/accreditedLandlords",
    nonStudentRoute: "/landlords",
  },
  {
    label: "Chat Help",
    icon: icons.chat,
    tintColor: "#10B981",
    route: "/message",
  },
  {
    label: "Schedules",
    icon: icons.calendar,
    tintColor: "#F59E0B",
    route: "/calendar",
  },
];

const QuickActions = () => {
  const { user } = useAuthStore();
  const student = isStudentTenant(user);

  const openAction = (action: QuickAction) => {
    const destination =
      !student && action.nonStudentRoute
        ? action.nonStudentRoute
        : action.route;

    router.push(destination as any);
  };

  return (
    <View className="mt-4 flex-row justify-between px-5">
      {actions.map((action) => (
        <TouchableOpacity
          key={action.label}
          className="items-center justify-center"
          onPress={() => openAction(action)}
        >
          <Image
            source={action.icon}
            className="mb-1 size-10"
            style={{ tintColor: action.tintColor }}
          />
          <Text className="text-xs font-rubik text-black-200">
            {action.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default QuickActions;
