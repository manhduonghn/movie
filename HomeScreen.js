// HomeScreen.js
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MovieListSection from './MovieListSection'; // Component mới để hiển thị danh sách ngang

// Định nghĩa các loại phim (giữ nguyên từ code cũ)
const TYPE_FILTERS = [
    { name: 'Phim Bộ', slug: 'phim-bo', type: 'type_list' },
    { name: 'Phim Lẻ', slug: 'phim-le', type: 'type_list' },
    { name: 'TV Show', slug: 'tv-shows', type: 'type_list' },
    { name: 'Hoạt Hình', slug: 'hoat-hinh', type: 'type_list' },
];

const HISTORY_FILTER = { name: 'LỊCH SỬ ĐÃ XEM', slug: 'history', type: 'history' };

export default function HomeScreen({ navigation }) {
    const { width: screenWidth } = useWindowDimensions();

    const navigateToList = useCallback((filter) => {
        // Dùng Route MovieList để hiển thị danh sách phim theo filter
        navigation.navigate('MovieList', { 
            title: filter.name,
            filter: filter,
        });
    }, [navigation]);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={styles.searchBar}>
                <TouchableOpacity style={styles.searchButton} onPress={() => navigation.navigate('NewFilms')}>
                    <Ionicons name="search" size={20} color="#121212" />
                    <Text style={styles.searchText}>Tìm kiếm phim...</Text>
                </TouchableOpacity>
            </View>

            <MovieListSection 
                title="Lịch Sử Đã Xem"
                filter={HISTORY_FILTER}
                navigation={navigation}
                viewAll={() => navigateToList(HISTORY_FILTER)}
                horizontal={true} // Hiện danh sách ngang cho Home
            />

            <View style={styles.sectionDivider} />

            {TYPE_FILTERS.map((filter) => (
                <MovieListSection
                    key={filter.slug}
                    title={filter.name}
                    filter={filter}
                    navigation={navigation}
                    viewAll={() => navigateToList(filter)}
                    horizontal={true}
                />
            ))}
            
            <View style={{ height: 60 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#121212' },
    contentContainer: { paddingBottom: 20 },
    searchBar: {
        padding: 10,
        backgroundColor: '#1E1E1E',
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    searchButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFD700',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 10,
    },
    searchText: {
        marginLeft: 10,
        color: '#121212',
        fontFamily: 'Roboto-Bold',
    },
    sectionDivider: {
        height: 1,
        backgroundColor: '#333',
        marginVertical: 10,
        marginHorizontal: 15,
    },
});
