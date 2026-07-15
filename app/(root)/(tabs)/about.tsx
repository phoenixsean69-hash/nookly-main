// app/(root)/about.tsx
import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import images from "@/constants/images";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Contributor {
  name: string;
  role: string;
  avatar?: string;
  github?: string;
  linkedin?: string;
}

export default function AboutScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const [appVersion, setAppVersion] = useState("1.0.0");
  const [buildNumber, setBuildNumber] = useState("1");
  const [appName, setAppName] = useState("Restate");
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);

  useEffect(() => {
    loadAppInfo();
  }, []);

  const loadAppInfo = () => {
    try {
      const version = Application.nativeApplicationVersion || "1.0.0";
      const build = Application.nativeBuildVersion || "1";
      const name = Constants.expoConfig?.name || "Restate";

      setAppVersion(version);
      setBuildNumber(build);
      setAppName(name);
    } catch (error) {
      console.error("Error loading app info:", error);
    }
  };

  const handleOpenLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await WebBrowser.openBrowserAsync(url);
      } else {
        Alert.alert("Error", "Cannot open link");
      }
    } catch (error) {
      console.error("Error opening link:", error);
      Alert.alert("Error", "Failed to open link");
    }
  };

  const handleSendFeedback = () => {
    const email = "support@restate.com";
    const subject = "Restate App Feedback";
    const body = `App Version: ${appVersion}\nBuild: ${buildNumber}\n\nFeedback: `;
    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    handleOpenLink(url);
  };

  const handleRateApp = () => {
    Alert.alert(
      "Rate App",
      "Would you like to rate this app on the app store?",
      [
        { text: "Not Now", style: "cancel" },
        {
          text: "Rate",
          onPress: () => {
            const storeUrl = "https://apps.apple.com/app/id123456789";
            handleOpenLink(storeUrl);
          },
        },
      ],
    );
  };

  const PrivacyPolicyModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={privacyModalVisible}
      onRequestClose={() => setPrivacyModalVisible(false)}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View
          className="rounded-t-3xl p-6"
          style={{
            backgroundColor: theme.background,
            maxHeight: "90%",
          }}
        >
          <View
            className="flex-row justify-between items-center mb-6 pb-2 border-b"
            style={{ borderBottomColor: theme.muted + "20" }}
          >
            <Text
              className="text-2xl font-rubik-bold"
              style={{ color: theme.title }}
            >
              Privacy Policy
            </Text>
            <TouchableOpacity onPress={() => setPrivacyModalVisible(false)}>
              <Text className="text-2xl" style={{ color: theme.muted }}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            <Text
              className="text-sm leading-6 mb-6"
              style={{ color: theme.muted }}
            >
              Last updated: March 25, 2024
            </Text>

            <View className="mb-6">
              <Text
                className="text-lg font-rubik-bold mb-3"
                style={{ color: theme.title }}
              >
                1. Information We Collect
              </Text>
              <Text className="text-sm leading-6" style={{ color: theme.text }}>
                We collect information you provide directly to us, such as when
                you create an account, fill out a form, or communicate with us.
                This may include your name, email address, phone number, and
                property details.
              </Text>
            </View>

            <View className="mb-6">
              <Text
                className="text-lg font-rubik-bold mb-3"
                style={{ color: theme.title }}
              >
                2. How We Use Your Information
              </Text>
              <Text className="text-sm leading-6" style={{ color: theme.text }}>
                We use the information we collect to provide, maintain, and
                improve our services, to communicate with you, and to
                personalize your experience.
              </Text>
            </View>

            <View className="mb-6">
              <Text
                className="text-lg font-rubik-bold mb-3"
                style={{ color: theme.title }}
              >
                3. Data Security
              </Text>
              <Text className="text-sm leading-6" style={{ color: theme.text }}>
                We implement appropriate technical and organizational measures
                to protect your personal information against unauthorized
                access, alteration, disclosure, or destruction.
              </Text>
            </View>

            <View className="mb-6">
              <Text
                className="text-lg font-rubik-bold mb-3"
                style={{ color: theme.title }}
              >
                4. Data Sharing
              </Text>
              <Text className="text-sm leading-6" style={{ color: theme.text }}>
                We do not sell, trade, or rent your personal information to
                third parties. We may share information with service providers
                who assist us in operating our app.
              </Text>
            </View>

            <View className="mb-6">
              <Text
                className="text-lg font-rubik-bold mb-3"
                style={{ color: theme.title }}
              >
                5. Your Rights
              </Text>
              <Text className="text-sm leading-6" style={{ color: theme.text }}>
                You have the right to access, correct, or delete your personal
                information. You can do this through your account settings or by
                contacting us.
              </Text>
            </View>

            <View className="mb-4">
              <Text
                className="text-lg font-rubik-bold mb-3"
                style={{ color: theme.title }}
              >
                6. Contact Us
              </Text>
              <Text className="text-sm leading-6" style={{ color: theme.text }}>
                If you have any questions about this Privacy Policy, please
                contact us at: privacy@restate.com
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const TermsOfServiceModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={termsModalVisible}
      onRequestClose={() => setTermsModalVisible(false)}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View
          className="rounded-t-3xl p-6"
          style={{
            backgroundColor: theme.background,
            maxHeight: "90%",
          }}
        >
          <View
            className="flex-row justify-between items-center mb-6 pb-2 border-b"
            style={{ borderBottomColor: theme.muted + "20" }}
          >
            <Text
              className="text-2xl font-rubik-bold"
              style={{ color: theme.title }}
            >
              Terms of Service
            </Text>
            <TouchableOpacity onPress={() => setTermsModalVisible(false)}>
              <Text className="text-2xl" style={{ color: theme.muted }}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            <Text
              className="text-sm leading-6 mb-6"
              style={{ color: theme.muted }}
            >
              Last updated: March 25, 2024
            </Text>

            <View className="mb-6">
              <Text
                className="text-lg font-rubik-bold mb-3"
                style={{ color: theme.title }}
              >
                1. Acceptance of Terms
              </Text>
              <Text className="text-sm leading-6" style={{ color: theme.text }}>
                By accessing or using Restate, you agree to be bound by these
                Terms of Service and our Privacy Policy. If you do not agree to
                these terms, please do not use our app.
              </Text>
            </View>

            <View className="mb-6">
              <Text
                className="text-lg font-rubik-bold mb-3"
                style={{ color: theme.title }}
              >
                2. User Accounts
              </Text>
              <Text className="text-sm leading-6" style={{ color: theme.text }}>
                You are responsible for maintaining the security of your account
                and for any activities that occur under your account. You must
                provide accurate and complete information when creating an
                account.
              </Text>
            </View>

            <View className="mb-6">
              <Text
                className="text-lg font-rubik-bold mb-3"
                style={{ color: theme.title }}
              >
                3. Property Listings
              </Text>
              <Text className="text-sm leading-6" style={{ color: theme.text }}>
                Landlords are responsible for the accuracy of their property
                listings. nookly does not verify the accuracy of listings and is
                not responsible for any disputes between landlords and tenants.
              </Text>
            </View>

            <View className="mb-6">
              <Text
                className="text-lg font-rubik-bold mb-3"
                style={{ color: theme.title }}
              >
                4. Prohibited Activities
              </Text>
              <Text className="text-sm leading-6" style={{ color: theme.text }}>
                You may not use Restate for any illegal purpose or to violate
                any laws in your jurisdiction. This includes posting fraudulent
                listings, harassing other users, or impersonating others.
              </Text>
            </View>

            <View className="mb-6">
              <Text
                className="text-lg font-rubik-bold mb-3"
                style={{ color: theme.title }}
              >
                5. Termination
              </Text>
              <Text className="text-sm leading-6" style={{ color: theme.text }}>
                We reserve the right to suspend or terminate accounts that
                violate these terms. You may delete your account at any time
                through your account settings.
              </Text>
            </View>

            <View className="mb-6">
              <Text
                className="text-lg font-rubik-bold mb-3"
                style={{ color: theme.title }}
              >
                6. Limitation of Liability
              </Text>
              <Text className="text-sm leading-6" style={{ color: theme.text }}>
                Restate is provided "as is" without warranties of any kind. We
                are not liable for any damages arising from your use of the app.
              </Text>
            </View>

            <View className="mb-4">
              <Text
                className="text-lg font-rubik-bold mb-3"
                style={{ color: theme.title }}
              >
                7. Changes to Terms
              </Text>
              <Text className="text-sm leading-6" style={{ color: theme.text }}>
                We may modify these terms at any time. Continued use of the app
                after changes constitutes acceptance of the new terms.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header - Simplified */}
      <View className="flex-row items-center px-6 py-5">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Image
            source={icons.backArrow}
            className="w-6 h-6"
            style={{ tintColor: theme.text }}
          />
        </TouchableOpacity>
        <Text
          className="text-2xl font-rubik-bold"
          style={{ color: theme.title }}
        >
          About
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* App Logo & Name*/}
        <View className="items-center py-12">
          <View className="w-28 h-28 rounded-2xl items-center justify-center mb-6">
            <Image source={images.appLogo} className="w-20 h-20" />
          </View>
          <Text
            className="text-3xl font-rubik-bold mb-2"
            style={{ color: theme.title }}
          >
            {appName}
          </Text>
          <Text className="text-sm font-rubik" style={{ color: theme.muted }}>
            Version {appVersion} ({buildNumber})
          </Text>
        </View>

        {/* Description - Minimal */}
        <View className="px-6 mb-12">
          <Text
            className="text-base leading-6 text-center"
            style={{ color: theme.text }}
          >
            A modern property management platform that connects landlords with
            tenants seamlessly. Find, rent, and manage properties with ease.
          </Text>
        </View>

        {/* Key Features - Clean Grid */}
        <View className="px-6 mb-12">
          <Text
            className="text-xl font-rubik-bold mb-5"
            style={{ color: theme.title }}
          >
            Features
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {[
              { icon: icons.house, title: "Property Listings" },
              { icon: icons.calendar, title: "Calendar" },
              { icon: icons.bell, title: "Notifications" },
              { icon: icons.chat, title: "Messaging" },
              { icon: icons.wallet, title: "Payments" },
              { icon: icons.star, title: "Reviews" },
            ].map((feature, index) => (
              <View
                key={index}
                className="flex-row items-center px-4 py-2 rounded-full"
                style={{
                  backgroundColor: theme.primary[100] + "20",
                }}
              >
                <Image
                  source={feature.icon}
                  className="w-4 h-4 mr-2"
                  style={{ tintColor: theme.primary[300] }}
                />
                <Text
                  className="text-sm font-rubik-medium"
                  style={{ color: theme.text }}
                >
                  {feature.title}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Legal Links - Simplified */}
        <View className="px-6 mb-12">
          <View className="rounded-2xl overflow-hidden">
            <TouchableOpacity
              onPress={() => setPrivacyModalVisible(true)}
              className="flex-row items-center justify-between py-4"
            >
              <Text className="font-rubik-medium" style={{ color: theme.text }}>
                Privacy Policy
              </Text>
              <Image
                source={icons.rightArrow}
                className="w-5 h-5"
                style={{ tintColor: theme.muted }}
              />
            </TouchableOpacity>

            <View
              className="h-px"
              style={{ backgroundColor: theme.muted + "20" }}
            />

            <TouchableOpacity
              onPress={() => setTermsModalVisible(true)}
              className="flex-row items-center justify-between py-4"
            >
              <Text className="font-rubik-medium" style={{ color: theme.text }}>
                Terms of Service
              </Text>
              <Image
                source={icons.rightArrow}
                className="w-5 h-5"
                style={{ tintColor: theme.muted }}
              />
            </TouchableOpacity>

            <View
              className="h-px"
              style={{ backgroundColor: theme.muted + "20" }}
            />

            <TouchableOpacity
              onPress={handleSendFeedback}
              className="flex-row items-center justify-between py-4"
            >
              <Text className="font-rubik-medium" style={{ color: theme.text }}>
                Send Feedback
              </Text>
              <Image
                source={icons.rightArrow}
                className="w-5 h-5"
                style={{ tintColor: theme.muted }}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Buttons - Minimal */}
        <View className="px-6 mb-12 gap-3">
          <TouchableOpacity
            onPress={handleRateApp}
            className="py-4 rounded-xl items-center"
            style={{ backgroundColor: theme.primary[100] }}
          >
            <Text
              className="font-rubik-medium"
              style={{ color: theme.primary[300] }}
            >
              Rate the App
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/help")}
            className="py-4 rounded-xl items-center border"
            style={{ borderColor: theme.muted + "30" }}
          >
            <Text className="font-rubik-medium" style={{ color: theme.text }}>
              Contact Support
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer - Minimal */}
        <View className="items-center pb-8">
          <Text className="text-xs" style={{ color: theme.muted }}>
            © 2026 Nookly. All rights reserved.
          </Text>
        </View>
      </ScrollView>

      <PrivacyPolicyModal />
      <TermsOfServiceModal />
    </SafeAreaView>
  );
}
