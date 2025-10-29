// CountryScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    TouchableOpacity, 
    useWindowDimensions, 
    FlatList,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native'; // Import hook điều hướng

const API_COUNTRIES = 'https://phimapi.com/quoc-gia';

export default function CountryScreen() {
    // 1. Sử dụng hook useNavigation
    const navigation = useNavigation();
    
    const { width } = useWindowDimensions();
    // Tùy chỉnh số cột hiển thị
    const numColumns = width > 768 ? 4 : (width > 480 ? 3 : 2);

    const [countries, setCountries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // 2. Logic Fetch Dữ liệu Quốc gia
    const fetchCountries = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(API_COUNTRIES);
            const json = await response.json();
            
            if (Array.isArray(json) && json.length > 0) {
                setCountries(json);
            } else {
                setError('Không thể tải danh sách quốc gia.');
            }
        } catch (e) {
            console.error("Fetch Country Error:", e);
            setError('Lỗi kết nối hoặc xử lý dữ liệu.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCountries();
    }, [fetchCountries]);


    // 3. Hàm xử lý khi chọn một Quốc gia
    const handleSelect = useCallback((item) => {
        const filter = { 
            name: item.name, 
            slug: item.slug, 
            type: 'country' // Loại filter để NewFilmsScreen biết gọi API quốc gia
        };
        
        // Điều hướng đến Route MovieList
        navigation.navigate('MovieList', { 
            title: `Phim Quốc Gia: ${item.name}`,
            filter: filter,
        });
    }, [navigation]);

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={[styles.itemContainer, { width: (width / numColumns) - 20 }]}
            onPress={() => handleSelect(item)}
        >
            <Ionicons name="location-outline" size={24} color="#00BFFF" />
            <Text style={styles.itemText} numberOfLines={2}>{item.name}</Text>
        </TouchableOpacity>
    );

    const renderContent = () => {
        if (loading) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#00BFFF" />
                    <Text style={styles.statusText}>Đang tải quốc gia...</Text>
                </View>
            );
        }

        if (error) {
            return (
                <View style={styles.loadingContainer}>
                    <Ionicons name="alert-circle-outline" size={40} color="#FF4444" />
                    <Text style={styles.statusTextError}>{error}</Text>
                    <TouchableOpacity onPress={fetchCountries} style={styles.retryButton}>
                        <Text style={styles.retryButtonText}>Thử lại</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        
        return (
            <FlatList
                data={countries}
                renderItem={renderItem}
                keyExtractor={(item) => item.slug}
                numColumns={numColumns}
                contentContainerStyle={styles.listContainer}
                key={numColumns} // Thay đổi key khi numColumns thay đổi
            />
        );
    }


    return (
        <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
             <View style={styles.headerContainer}>
                <Text style={styles.headerText}>CHỌN QUỐC GIA PHIM</Text>
            </View>
            {renderContent()}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#121212' },
    headerContainer: { 
        padding: 15, 
        borderBottomWidth: 1, 
        borderBottomColor: '#333', 
        alignItems: 'center',
        backgroundColor: '#1E1E1E',
    },
    headerText: { fontSize: 20, fontFamily: 'Roboto-Bold', color: '#FFD700' },
    listContainer: { paddingHorizontal: 5, paddingVertical: 15, justifyContent: 'center' },
    itemContainer: {
        backgroundColor: '#1E1E1E',
        padding: 15,
        margin: 5,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        height: 100,
        borderLeftWidth: 3,
        borderLeftColor: '#00BFFF', // Màu xanh dương cho Quốc gia
        elevation: 3,
    },
    itemText: {
        marginTop: 5,
        color: '#FFFFFF',
        fontFamily: 'Roboto-Bold',
        textAlign: 'center',
        fontSize: 14,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusText: {
        color: '#FFFFFF',
        marginTop: 10,
        fontFamily: 'Roboto-Regular',
    },
    statusTextError: {
        color: '#FF4444',
        marginTop: 10,
        fontFamily: 'Roboto-Regular',
        textAlign: 'center',
    },
    retryButton: {
        backgroundColor: '#00BFFF',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 5,
        marginTop: 15,
    },
    retryButtonText: {
        color: '#121212',
        fontFamily: 'Roboto-Bold',
    }
});

