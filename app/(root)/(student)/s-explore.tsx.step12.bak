import { Card, FeaturedCard } from "@/components/Cards";
import FullMap from "@/components/FullMap";
import NoResults from "@/components/NoResults";
import StudentEmergencyPanel from "@/components/StudentEmergencyPanel";
import StudentFilters from "@/components/StudentFilters";
import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import {
  ApprovedOrganization,
  fetchStudentHousing,
  filterStudentHousing,
  getUniversityApprovedBoardingProperties,
  StudentProperty,
  titleCaseStudentText,
} from "@/lib/studentHousing";
import useAuthStore from "@/store/auth.store";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const StudentExplore = () => {
  const { user } = useAuthStore();
  const params = useLocalSearchParams<{ filter?: string; query?: string }>();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const schoolLocation = user?.schoolLocation?.trim() || "";

  const [allProperties, setAllProperties] = useState<StudentProperty[]>([]);
  const [approvedProperties, setApprovedProperties] = useState<
    StudentProperty[]
  >([]);
  const [organizations, setOrganizations] = useState<ApprovedOrganization[]>(
    [],
  );
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("all");
  const [query, setQuery] = useState(params.query || "");
  const [fullMapVisible, setFullMapVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadExplore = useCallback(
    async (force = false) => {
      if (!schoolLocation) {
        setAllProperties([]);
        setApprovedProperties([]);
        setOrganizations([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const studentProperties = await fetchStudentHousing(schoolLocation, {
          force,
        });
        const approved = await getUniversityApprovedBoardingProperties(
          schoolLocation,
          studentProperties,
          force,
        );

        setAllProperties(studentProperties);
        setApprovedProperties(approved.properties);
        setOrganizations(approved.organizations);
      } catch (error) {
        console.error("Error loading student explore:", error);
        setAllProperties([]);
        setApprovedProperties([]);
        setOrganizations([]);
      } finally {
        setLoading(false);
      }
    },
    [schoolLocation],
  );

  useEffect(() => {
    loadExplore();
  }, [loadExplore]);

  useEffect(() => {
    setQuery(params.query || "");
  }, [params.query]);

  const properties = useMemo(
    () =>
      filterStudentHousing(allProperties, {
        type: params.filter || "",
        query,
      }),
    [allProperties, params.filter, query],
  );

  const approvedForOrganization = useMemo(() => {
    if (selectedOrganizationId === "all") return approvedProperties;
    return approvedProperties.filter(
      (property) => property.organizationId === selectedOrganizationId,
    );
  }, [approvedProperties, selectedOrganizationId]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadExplore(true);
    setRefreshing(false);
  }, [loadExplore]);

  const handlePropertyPress = useCallback(
    (id: string) => router.push(`/properties/${id}` as any),
    [],
  );

  const Header = useCallback(
    () => (
      <View className="px-5 pt-5 pb-2">
        <Text
          className="text-2xl text-center font-rubik-bold mb-1"
          style={{ color: theme.title }}
        >
          Student Housing
        </Text>
        <Text
          className="text-sm text-center mb-4"
          style={{ color: theme.muted }}
        >
          Boarding Houses, Houses, Studios and Luxury properties within{" "}
          {schoolLocation
            ? titleCaseStudentText(schoolLocation)
            : "your school location"}
        </Text>

        <TouchableOpacity
          onPress={() => setFullMapVisible(true)}
          activeOpacity={0.9}
          className="mb-4 rounded-2xl overflow-hidden"
          style={{
            height: 120,
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: `${theme.muted}30`,
          }}
        >
          <View
            className="flex-1 p-4 items-center justify-center"
            style={{ backgroundColor: theme.primary[100] }}
          >
            <Ionicons name="map" size={32} color={theme.primary[300]} />
            <Text
              className="font-rubik-bold mt-1"
              style={{ color: theme.primary[300] }}
            >
              {properties.length} supported properties on map
            </Text>
            <Text className="text-xs mt-1" style={{ color: theme.muted }}>
              Map pins use the same student location and property-type rules
            </Text>
          </View>
        </TouchableOpacity>

        <View
          className="flex-row items-center px-4 py-3 rounded-full mb-3"
          style={{
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: `${theme.muted}40`,
          }}
        >
          <Image
            source={icons.search}
            className="w-5 h-5"
            style={{ tintColor: theme.muted }}
          />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search name, address, type or facilities..."
            placeholderTextColor={theme.muted}
            className="flex-1 ml-2 text-sm"
            style={{ color: theme.text }}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={19} color={theme.muted} />
            </TouchableOpacity>
          )}
        </View>

        <StudentFilters />

        <View className="mb-6 mt-4">
          <View className="flex-row items-center">
            <View
              className="w-9 h-9 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: "#10B98118" }}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color="#10B981"
              />
            </View>
            <View className="flex-1">
              <Text
                className="text-xl font-rubik-bold"
                style={{ color: theme.title }}
              >
                Boarding Houses Approved by Universities
              </Text>
              <Text className="text-xs" style={{ color: theme.muted }}>
                Posted by organizations whose city matches your school location
              </Text>
            </View>
          </View>

          {organizations.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="my-3"
            >
              <TouchableOpacity
                onPress={() => setSelectedOrganizationId("all")}
                className="mr-2 px-4 py-2 rounded-full"
                style={{
                  backgroundColor:
                    selectedOrganizationId === "all"
                      ? theme.primary[300]
                      : theme.surface,
                  borderWidth: 1,
                  borderColor: `${theme.muted}35`,
                }}
              >
                <Text
                  className="text-xs font-rubik-medium"
                  style={{
                    color:
                      selectedOrganizationId === "all" ? "#FFFFFF" : theme.text,
                  }}
                >
                  All Universities
                </Text>
              </TouchableOpacity>

              {organizations.map((organization) => (
                <TouchableOpacity
                  key={organization.$id}
                  onPress={() => setSelectedOrganizationId(organization.$id)}
                  className="mr-2 px-4 py-2 rounded-full"
                  style={{
                    backgroundColor:
                      selectedOrganizationId === organization.$id
                        ? theme.primary[300]
                        : theme.surface,
                    borderWidth: 1,
                    borderColor: `${theme.muted}35`,
                  }}
                >
                  <Text
                    className="text-xs font-rubik-medium"
                    style={{
                      color:
                        selectedOrganizationId === organization.$id
                          ? "#FFFFFF"
                          : theme.text,
                    }}
                  >
                    {organization.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {approvedForOrganization.length === 0 ? (
            <View
              className="rounded-xl p-4 mt-3"
              style={{ backgroundColor: theme.surface }}
            >
              <Text
                className="text-sm text-center"
                style={{ color: theme.muted }}
              >
                No university-posted boarding houses are available for this
                location yet.
              </Text>
            </View>
          ) : (
            <FlatList
              data={approvedForOrganization}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => `approved-${item.$id}`}
              renderItem={({ item }) => (
                <View className="mr-4 mt-3">
                  <FeaturedCard
                    item={item}
                    onPress={() => handlePropertyPress(item.$id)}
                  />
                  <View className="mt-1 flex-row items-center">
                    <Ionicons
                      name="shield-checkmark"
                      size={13}
                      color="#10B981"
                    />
                    <Text
                      className="text-[10px] ml-1 font-rubik-medium"
                      style={{ color: "#10B981" }}
                    >
                      {item.organizationName}
                    </Text>
                  </View>
                </View>
              )}
            />
          )}
        </View>

        <StudentEmergencyPanel />

        <View className="flex-row justify-between items-center mb-2">
          <View>
            <Text
              className="text-xl font-rubik-bold"
              style={{ color: theme.title }}
            >
              All Student Properties
            </Text>
            <Text className="text-xs" style={{ color: theme.muted }}>
              Ranked by ratings, engagement and demand
            </Text>
          </View>
          <Text
            className="font-rubik-bold"
            style={{ color: theme.primary[300] }}
          >
            {properties.length}
          </Text>
        </View>
      </View>
    ),
    [
      theme,
      schoolLocation,
      properties,
      query,
      organizations,
      selectedOrganizationId,
      approvedForOrganization,
      handlePropertyPress,
    ],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <FlatList
        data={properties}
        numColumns={2}
        renderItem={({ item }) => (
          <Card item={item} onPress={() => handlePropertyPress(item.$id)} />
        )}
        keyExtractor={(item) => item.$id}
        contentContainerStyle={{ paddingBottom: 120 }}
        columnWrapperStyle={{ gap: 20, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={theme.primary[300]}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View className="items-center justify-center py-20">
              <ActivityIndicator size="large" color={theme.primary[300]} />
            </View>
          ) : (
            <NoResults />
          )
        }
        ListHeaderComponent={Header}
      />

      <FullMap
        visible={fullMapVisible}
        onClose={() => setFullMapVisible(false)}
        properties={properties}
        onPropertyPress={(id: string) => {
          setFullMapVisible(false);
          handlePropertyPress(id);
        }}
      />
    </SafeAreaView>
  );
};

export default StudentExplore;
