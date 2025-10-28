// GenreScreen.js
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
// Import hook cần thiết để truy cập đối tượng navigation
import { useNavigation } from '@react-navigation/native'; 

const API_GENRES = 'https://phimapi.com/the-loai';

export default function GenreScreen() {
    // 1. Sử dụng hook useNavigation để lấy đối tượng navigation
    const navigation = useNavigation();
    
    const { width } = useWindowDimensions();
    // Tùy chỉnh số cột hiển thị dựa trên kích thước màn hình
    const numColumns = width > 768 ? 4 : (width > 480 ? 3 : 2);

    const [genres, setGenres] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // 2. Logic Fetch Dữ liệu Thể loại
    const fetchGenres = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(API_GENRES);
            const json = await response.json();
            
            if (Array.isArray(json) && json.length > 0) {
                setGenres(json);
            } else {
                setError('Không thể tải danh sách thể loại.');
            }
        } catch (e) {
            console.error("Fetch Genre Error:", e);
            setError('Lỗi kết nối hoặc xử lý dữ liệu.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchGenres();
    }, [fetchGenres]);


    // 3. Hàm xử lý khi chọn một thể loại
    const handleSelect = useCallback((item) => {
        const filter = { 
            name: item.name, 
            slug: item.slug, 
            type: 'genre' // Loại filter để NewFilmsScreen biết gọi API thể loại
        };
        
        // Điều hướng đến Route MovieList (NewFilmsScreen) đã được thiết lập trong App.js
        navigation.navigate('MovieList', { 
            title: `Phim Thể Loại: ${item.name}`,
            filter: filter,
        });
    }, [navigation]);

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={[styles.itemContainer, { width: (width / numColumns) - 20 }]}
            onPress={() => handleSelect(item)}
        >
            <Ionicons name="film-outline" size={24} color="#FFD700" />
            <Text style={styles.itemText} numberOfLines={2}>{item.name}</Text>
        </TouchableOpacity>
    );

    const renderContent = () => {
        if (loading) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FFD700" />
                    <Text style={styles.statusText}>Đang tải thể loại...</Text>
                </View>
            );
        }

        if (error) {
            return (
                <View style={styles.loadingContainer}>
                    <Ionicons name="alert-circle-outline" size={40} color="#FF4444" />
                    <Text style={styles.statusTextError}>{error}</Text>
                    <TouchableOpacity onPress={fetchGenres} style={styles.retryButton}>
                        <Text style={styles.retryButtonText}>Thử lại</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        
        return (
            <FlatList
                data={genres}
                renderItem={renderItem}
                keyExtractor={(item) => item.slug}
                numColumns={numColumns}
                contentContainerStyle={styles.listContainer}
                key={numColumns} // Thay đổi key khi numColumns thay đổi để buộc FlatList render lại
            />
        );
    }


    return (
        <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
             <View style={styles.headerContainer}>
                <Text style={styles.headerText}>CHỌN THỂ LOẠI PHIM</Text>
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
    headerText: { fontSize: 20, fontFamily: 'Roboto-Bold', color: '#00BFFF' },
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
        borderLeftColor: '#FFD700',
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
        backgroundColor: '#FFD700',
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

