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
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 

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
                        headerShown: true,
                    }}
                />
                <Stack.Screen
                    name="Detail"
                    component={DetailScreen}
                    // Truyền cả 'route' và 'navigation' vào hàm options
                    options={({ route, navigation }) => ({ 
                        // Sửa lỗi ReferenceError bằng cách sử dụng route đã được truyền vào
                        title: route.params.movieName,
                        // Thêm icon Home bên trái
                        headerLeft: () => (
                            <TouchableOpacity
                                // Quay về màn hình đầu tiên trong stack (Home)
                                onPress={() => navigation.popToTop()} 
                                // Thiết lập padding hợp lý để icon cách lề và cách tiêu đề
                                style={{ paddingRight: 15 }} 
                            >
                                <Ionicons 
                                    name="home" // Icon Home
                                    size={24} 
                                    color="#FFD700" // Màu icon
                                />
                            </TouchableOpacity>
                        ),
                    })}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
