import ProfileHeader from "@/components/ProfileHeader";
import { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

export default function Language() {
  const [language, setLanguage] = useState<"en" | "sn">("en");

  const translations = {
    en: {
      title: "Language",
      english: "English",
      shona: "Shona",
      selected: "Selected",
      message: "This is a test message.",
    },
    sn: {
      title: "Mutauro",
      english: "Chirungu",
      shona: "ChiShona",
      selected: "Yasarudzwa",
      message: "Uyu muenzaniso we meseji.",
    },
  };

  const t = translations[language];

  return (
    <View className="flex-1 bg-white">
      <ProfileHeader title={t.title} />

      <ScrollView className="px-6 pt-6">
        {/* English */}
        <TouchableOpacity
          onPress={() => setLanguage("en")}
          className={`p-6 rounded-3xl mb-4 ${
            language === "en" ? "bg-blue-50" : "bg-gray-50"
          }`}
        >
          <Text
            className={`font-rubik-bold ${
              language === "en" ? "text-blue-600" : "text-gray-900"
            }`}
          >
            {t.english} {language === "en" && `(${t.selected})`}
          </Text>
        </TouchableOpacity>

        {/* Shona */}
        <TouchableOpacity
          onPress={() => setLanguage("sn")}
          className={`p-6 rounded-3xl ${
            language === "sn" ? "bg-blue-50" : "bg-gray-50"
          }`}
        >
          <Text
            className={`font-rubik-bold ${
              language === "sn" ? "text-blue-600" : "text-gray-900"
            }`}
          >
            {t.shona} {language === "sn" && `(${t.selected})`}
          </Text>
        </TouchableOpacity>

        {/* Test Text */}
        <View className="mt-10">
          <Text className="text-lg text-gray-700 text-center">{t.message}</Text>
        </View>
      </ScrollView>
    </View>
  );
}
