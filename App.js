import 'react-native-gesture-handler';
import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen'; 
import { useFonts } from 'expo-font';
import { 
  Roboto_400Regular, // Font thường
  Roboto_700Bold,    // Font đậm
} from '@expo-google-fonts/roboto'; 
import { View } from 'react-native';

import HomeScreen from './HomeScreen';
import DetailScreen from './DetailScreen'; 

// Giữ Splash Screen hiển thị cho đến khi font được tải
SplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator();

export default function App() {
  // Tải Font Roboto và đặt tên cho chúng
  const [fontsLoaded] = useFonts({
    'Roboto-Regular': Roboto_400Regular,
    'Roboto-Bold': Roboto_700Bold, 
  });

  React.useEffect(() => {
    async function prepare() {
      if (fontsLoaded) {
        // Font đã tải, ẩn Splash Screen
        await SplashScreen.hideAsync();
      }
    }
    prepare();
  }, [fontsLoaded]);


  if (!fontsLoaded) {
    // Nếu font chưa tải xong, tiếp tục hiển thị Splash Screen
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#1E1E1E',
          },
          headerTintColor: '#FFD700',
          // Áp dụng font Roboto-Bold cho tiêu đề Navigation Header
          headerTitleStyle: {
            fontFamily: 'Roboto-Bold',
          },
          headerBackTitleVisible: false,
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="Detail"
          component={DetailScreen}
          options={({ route }) => ({ title: route.params.movieName })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

