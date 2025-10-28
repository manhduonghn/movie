// App.js
import 'react-native-gesture-handler';
import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'; // Import Tab Navigator
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Roboto_400Regular, Roboto_700Bold } from '@expo-google-fonts/roboto';
import { TouchableOpacity, View, Text }
from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Import các màn hình mới
import NewFilmsScreen from './NewFilmsScreen'; // Phim mới cập nhật
import CountryScreen from './CountryScreen';   // Quốc gia
import GenreScreen from './GenreScreen';     // Thể loại
import DetailScreen from './DetailScreen';     
import HomeScreen from './HomeScreen';         // Home chính (mới)

import { cleanupOldCache } from './m3u8Processor'; 

SplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator(); // Khởi tạo Tab Navigator

// Dữ liệu Tĩnh cho Tab Navigator (có thể fetch dynamic nếu cần)
const API_GENRES_DATA = [
    {"name": "Hành Động", "slug": "hanh-dong"},
    {"name": "Tình Cảm", "slug": "tinh-cam"},
    {"name": "Hài Hước", "slug": "hai-huoc"},
    // ... Thêm các thể loại quan trọng khác
];

const API_COUNTRIES_DATA = [
    {"name": "Hàn Quốc", "slug": "han-quoc"},
    {"name": "Âu Mỹ", "slug": "au-my"},
    {"name": "Trung Quốc", "slug": "trung-quoc"},
    // ... Thêm các quốc gia quan trọng khác
];

// --- Tab Navigator Component ---
function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false, // Ẩn header mặc định của Tab
        tabBarActiveTintColor: '#FFD700', // Vàng
        tabBarInactiveTintColor: '#B0B0B0', // Xám
        tabBarStyle: { 
            backgroundColor: '#1E1E1E',
            borderTopColor: '#333',
            height: 60,
            paddingBottom: 5,
            paddingTop: 5,
        },
        tabBarLabelStyle: { fontFamily: 'Roboto-Bold', fontSize: 12 },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'HomeTab') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'NewFilms') {
            iconName = focused ? 'sparkles' : 'sparkles-outline';
          } else if (route.name === 'Genres') {
            iconName = focused ? 'film' : 'film-outline';
          } else if (route.name === 'Countries') {
            iconName = focused ? 'flag' : 'flag-outline';
          }

          // Trả về biểu tượng Ionicons
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
      initialRouteName="HomeTab"
    >
        <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: 'Trang Chủ' }} />
        <Tab.Screen name="NewFilms" component={NewFilmsScreen} options={{ title: 'Phim Mới' }} />
        <Tab.Screen 
            name="Genres" 
            // Truyền dữ liệu thể loại vào màn hình
            children={() => <GenreScreen genresData={API_GENRES_DATA} />} 
            options={{ title: 'Thể Loại' }} 
        />
        <Tab.Screen 
            name="Countries" 
            // Truyền dữ liệu quốc gia vào màn hình
            children={() => <CountryScreen countriesData={API_COUNTRIES_DATA} />} 
            options={{ title: 'Quốc Gia' }} 
        />
    </Tab.Navigator>
  );
}

// --- App Root Component ---
export default function App() {
  const [fontsLoaded] = useFonts({
    'Roboto-Regular': Roboto_400Regular,
    'Roboto-Bold': Roboto_700Bold,
  });

  React.useEffect(() => {
    async function prepare() {
      if (fontsLoaded) {
        await cleanupOldCache();
        await SplashScreen.hideAsync();
      }
    }
    prepare();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Main"
        screenOptions={{
          headerStyle: { backgroundColor: '#1E1E1E' },
          headerTintColor: '#FFD700',
          headerTitleStyle: { fontFamily: 'Roboto-Bold' },
          headerBackTitleVisible: false,
        }}
      >
        <Stack.Screen
          name="Main"
          component={MainTabNavigator}
          options={{
            headerShown: false, // Tab Navigator sẽ quản lý hiển thị các màn hình
          }}
        />
        <Stack.Screen
          name="Detail"
          component={DetailScreen}
          options={({ route, navigation }) => ({
            title: route.params?.movieName || 'Chi Tiết Phim',
            headerLeft: () => (
              <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 15 }}>
                <Ionicons name="arrow-back" size={24} color="#FFD700" />
              </TouchableOpacity>
            ),
          })}
        />
        {/* Route chung cho list phim theo thể loại/quốc gia. 
            Màn hình này sẽ sử dụng lại logic của NewFilmsScreen/HomeScreen cũ */}
        <Stack.Screen
          name="MovieList"
          component={NewFilmsScreen} 
          options={({ route }) => ({
            title: route.params?.title || 'Danh Sách Phim',
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
