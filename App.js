import 'react-native-gesture-handler';
import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
    Roboto_400Regular, 
    Roboto_700Bold,    
} from '@expo-google-fonts/roboto';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 

import HomeScreen from './HomeScreen';
import DetailScreen from './DetailScreen';

SplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator();

export default function App() {
    
    const [fontsLoaded] = useFonts({
        'Roboto-Regular': Roboto_400Regular,
        'Roboto-Bold': Roboto_700Bold,
    });

    React.useEffect(() => {
        async function prepare() {
            if (fontsLoaded) {
                await SplashScreen.hideAsync();
            }
        }
        prepare();
    }, [fontsLoaded]);

    if (!fontsLoaded) {
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
                    headerTitleStyle: {
                        fontFamily: 'Roboto-Bold',
                    },
                    headerBackTitleVisible: false,
                }}
            >
                <Stack.Screen
                    name="Home"
                    component={HomeScreen}
                    options={({ route }) => ({
                        headerShown: true,
                        title: 'PHIM HAY',
                        // Ẩn nút tìm kiếm nếu isSearchInputVisible (được truyền qua params) là TRUE
                        headerRight: () => {
                            const isSearchVisible = route.params?.isSearchInputVisible || false;
                            
                            if (isSearchVisible) {
                                return <View style={{ width: 34 }} />; // Giữ khoảng trống bên phải
                            }

                            return (
                                <TouchableOpacity
                                    onPress={() => route.params?.toggleSearch()}
                                    style={{ paddingLeft: 10 }}
                                >
                                    <Ionicons 
                                        name="search"
                                        size={24} 
                                        color="#FFD700"
                                    />
                                </TouchableOpacity>
                            );
                        }
                    })}
                />
                <Stack.Screen
                    name="Detail"
                    component={DetailScreen}
                    options={({ route, navigation }) => ({ 
                        title: route.params.movieName,
                        headerLeft: () => (
                            <TouchableOpacity
                                onPress={() => navigation.popToTop()} 
                                style={{ paddingRight: 15 }} 
                            >
                                <Ionicons 
                                    name="home" 
                                    size={24} 
                                    color="#FFD700" 
                                />
                            </TouchableOpacity>
                        ),
                    })}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
