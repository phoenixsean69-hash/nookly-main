import { Colors } from "@/constants/Colors";
import { downloadLeaseDocument } from "@/lib/leaseDocumentClient";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import Pdf from "react-native-pdf";

const getSingleParam = (
  value: string | string[] | undefined,
): string => {
  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return value || "";
};

export default function LeaseViewerScreen() {
  const params = useLocalSearchParams<{
    uri?: string | string[];
    name?: string | string[];
    requestId?: string | string[];
  }>();

  const localUri = getSingleParam(params.uri);
  const fileName =
    getSingleParam(params.name) || "Lease document.pdf";
  const requestId = getSingleParam(params.requestId);

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [page, setPage] = useState(1);
  const [numberOfPages, setNumberOfPages] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const source = useMemo(
    () => ({
      uri: localUri,
      cache: false,
    }),
    [localUri],
  );

  const handleDownload = async () => {
    if (!requestId || downloading) return;

    setDownloading(true);

    try {
      await downloadLeaseDocument(requestId, fileName);

      Alert.alert(
        "Lease downloaded",
        `${fileName} was saved to your Downloads folder.`,
      );
    } catch (error) {
      console.error("Lease viewer download failed:", error);

      Alert.alert(
        "Download failed",
        error instanceof Error
          ? error.message
          : "The lease could not be downloaded.",
      );
    } finally {
      setDownloading(false);
    }
  };

  if (!localUri) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: theme.background },
        ]}
      >
        <StatusBar
          barStyle={
            colorScheme === "dark"
              ? "light-content"
              : "dark-content"
          }
        />

        <View style={styles.emptyState}>
          <Ionicons
            name="document-text-outline"
            size={64}
            color={theme.muted}
          />

          <Text
            style={[
              styles.emptyTitle,
              { color: theme.title },
            ]}
          >
            Lease file unavailable
          </Text>

          <Text
            style={[
              styles.emptyMessage,
              { color: theme.muted },
            ]}
          >
            Return to My Requests and open the lease again.
          </Text>

          <Pressable
            onPress={() => router.back()}
            style={[
              styles.primaryButton,
              { backgroundColor: theme.primary[300] },
            ]}
          >
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.background },
      ]}
    >
      <StatusBar
        barStyle={
          colorScheme === "dark"
            ? "light-content"
            : "dark-content"
        }
      />

      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.navBackground,
            borderBottomColor: `${theme.muted}30`,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close lease viewer"
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={theme.text}
          />
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <Text
            numberOfLines={1}
            style={[
              styles.headerTitle,
              { color: theme.title },
            ]}
          >
            {fileName}
          </Text>

          <Text
            style={[
              styles.headerSubtitle,
              { color: theme.muted },
            ]}
          >
            {numberOfPages > 0
              ? `Page ${page} of ${numberOfPages}`
              : "Nookly PDF Viewer"}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Download lease"
          disabled={!requestId || downloading}
          onPress={() => {
            void handleDownload();
          }}
          style={[
            styles.headerButton,
            {
              opacity:
                !requestId || downloading
                  ? 0.45
                  : 1,
            },
          ]}
        >
          {downloading ? (
            <ActivityIndicator
              size="small"
              color={theme.primary[300]}
            />
          ) : (
            <Ionicons
              name="download-outline"
              size={24}
              color={theme.primary[300]}
            />
          )}
        </Pressable>
      </View>

      <View style={styles.viewerContainer}>
        <Pdf
          source={source}
          trustAllCerts={false}
          horizontal={false}
          enablePaging={false}
          enableDoubleTapZoom
          minScale={1}
          maxScale={4}
          spacing={10}
          onLoadProgress={() => {
            setLoading(true);
          }}
          onLoadComplete={(pages) => {
            setNumberOfPages(pages);
            setErrorMessage("");
            setLoading(false);
          }}
          onPageChanged={(currentPage, pages) => {
            setPage(currentPage);
            setNumberOfPages(pages);
          }}
          onError={(error) => {
            console.error("Built-in PDF viewer error:", error);

            setErrorMessage(
              error instanceof Error
                ? error.message
                : "The PDF could not be displayed.",
            );
            setLoading(false);
          }}
          style={[
            styles.pdf,
            {
              backgroundColor:
                colorScheme === "dark"
                  ? "#111827"
                  : "#E5E7EB",
              width: Dimensions.get("window").width,
            },
          ]}
        />

        {loading && !errorMessage && (
          <View
            style={[
              styles.overlay,
              {
                backgroundColor:
                  colorScheme === "dark"
                    ? "#111827"
                    : "#F3F4F6",
              },
            ]}
          >
            <ActivityIndicator
              size="large"
              color={theme.primary[300]}
            />

            <Text
              style={[
                styles.loadingText,
                { color: theme.text },
              ]}
            >
              Opening lease from this device…
            </Text>
          </View>
        )}

        {!!errorMessage && (
          <View
            style={[
              styles.overlay,
              {
                backgroundColor:
                  colorScheme === "dark"
                    ? "#111827"
                    : "#F3F4F6",
              },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={52}
              color="#EF4444"
            />

            <Text
              style={[
                styles.errorTitle,
                { color: theme.title },
              ]}
            >
              Could not display this PDF
            </Text>

            <Text
              style={[
                styles.errorMessage,
                { color: theme.muted },
              ]}
            >
              {errorMessage}
            </Text>

            <Pressable
              onPress={() => router.back()}
              style={[
                styles.primaryButton,
                { backgroundColor: theme.primary[300] },
              ]}
            >
              <Text style={styles.primaryButtonText}>
                Return to Requests
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.navBackground,
            borderTopColor: `${theme.muted}30`,
          },
        ]}
      >
        <Ionicons
          name="phone-portrait-outline"
          size={16}
          color={theme.muted}
        />

        <Text
          style={[
            styles.footerText,
            { color: theme.muted },
          ]}
        >
          Pinch to zoom • Double-tap to zoom
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    minHeight: 64,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleContainer: {
    flex: 1,
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontFamily: "Rubik-Bold",
    fontSize: 16,
  },
  headerSubtitle: {
    fontFamily: "Rubik-Regular",
    fontSize: 12,
    marginTop: 2,
  },
  viewerContainer: {
    flex: 1,
    position: "relative",
  },
  pdf: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  loadingText: {
    fontFamily: "Rubik-Medium",
    fontSize: 14,
    marginTop: 14,
    textAlign: "center",
  },
  errorTitle: {
    fontFamily: "Rubik-Bold",
    fontSize: 18,
    marginTop: 14,
    textAlign: "center",
  },
  errorMessage: {
    fontFamily: "Rubik-Regular",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center",
  },
  footer: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  footerText: {
    fontFamily: "Rubik-Regular",
    fontSize: 12,
    marginLeft: 7,
  },
  emptyState: {
    flex: 1,
    paddingHorizontal: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontFamily: "Rubik-Bold",
    fontSize: 20,
    marginTop: 16,
    textAlign: "center",
  },
  emptyMessage: {
    fontFamily: "Rubik-Regular",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center",
  },
  primaryButton: {
    marginTop: 22,
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontFamily: "Rubik-Bold",
    fontSize: 14,
  },
});
