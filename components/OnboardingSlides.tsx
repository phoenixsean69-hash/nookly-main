// components/OnboardingSlides.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width } = Dimensions.get("window");

interface Slide {
  id: number;
  title: string;
  description: string;
  image: any; // image source
}

const slides: Slide[] = [
  {
    id: 1,
    title: "Find Your Perfect Home",
    description:
      "Browse thousands of properties and discover the place that feels like home.",
    image: require("@/assets/images/foundHome.jpg"), // replace with your actual images
  },
  {
    id: 2,
    title: "Connect with Landlords",
    description:
      "Message landlords directly, schedule viewings, and get your questions answered.",
    image: require("@/assets/images/manageProperty.jpg"),
  },
  {
    id: 3,
    title: "Manage Rentals",
    description:
      "Keep track of payments, maintenance requests, and important dates.",
    image: require("@/assets/images/manageProperty.jpg"),
  },
  {
    id: 4,
    title: "Student Specials",
    description:
      "Find student-friendly rentals, boarding houses, and budget-friendly deals near your campus.",
    image: require("@/assets/images/happyStudents.jpg"),
  },
];

const OnboardingSlides = () => {
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(true);

  useEffect(() => {
    let interval: any;
    if (autoplay) {
      interval = setInterval(() => {
        if (currentIndex < slides.length - 1) {
          flatListRef.current?.scrollToIndex({
            index: currentIndex + 1,
            animated: true,
          });
          setCurrentIndex((prev) => prev + 1);
        } else {
          // loop to first slide
          flatListRef.current?.scrollToIndex({ index: 0, animated: true });
          setCurrentIndex(0);
        }
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [currentIndex, autoplay]);

  const handleScroll = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentIndex(index);
  };

  const renderSlide = ({ item }: { item: Slide }) => (
    <View
      style={{
        width,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
      }}
    >
      <View className="w-32 h-32 mb-6 rounded-full bg-white/10 items-center justify-center">
        <Image source={item.image} className="w-24 h-24" resizeMode="contain" />
      </View>
      <Text
        className="text-xl font-rubik-bold text-center mb-3"
        style={{ color: "#fff" }}
      >
        {item.title}
      </Text>
      <Text
        className="text-sm text-center"
        style={{ color: "#fff", opacity: 0.8 }}
      >
        {item.description}
      </Text>
    </View>
  );

  return (
    <View style={{ height: 300, marginBottom: 20 }}>
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id.toString()}
      />
      <View className="flex-row justify-center mt-4">
        {slides.map((_, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => {
              setAutoplay(false);
              flatListRef.current?.scrollToIndex({ index, animated: true });
              setCurrentIndex(index);
              // restart autoplay after user interaction (optional)
              setTimeout(() => setAutoplay(true), 5000);
            }}
            className={`mx-1 rounded-full ${currentIndex === index ? "w-6 h-2 bg-white" : "w-2 h-2 bg-white/40"}`}
          />
        ))}
      </View>
    </View>
  );
};

export default OnboardingSlides;
