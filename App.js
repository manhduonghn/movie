// App.js
import 'react-native-gesture-handler';
import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from './HomeScreen';
import DetailScreen from './DetailScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#1E1E1E', // Màu nền header
          },
          headerTintColor: '#FFD700', // Màu chữ header (vàng)
          headerBackTitleVisible: false, // Ẩn chữ "Back" trên iOS
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{
            headerShown: false, // Ẩn header trên màn hình Home
          }}
        />
        <Stack.Screen
          name="Detail"
          component={DetailScreen}
          // Lấy tên phim từ params để đặt tiêu đề
          options={({ route }) => ({ title: route.params.movieName })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
