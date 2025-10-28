// MovieListSection.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

// Import các component/hàm tiện ích đã định nghĩa trong NewFilmsScreen.js
// Giả định bạn đã copy MovieCard, getNumColumns, getLanguageTagData, LanguageTag, LanguageBanner
// vào file MovieListSection này.

// ************************************************
// LƯU Ý QUAN TRỌNG: 
// Bạn CẦN CHÈN (PASTE) TOÀN BỘ CODE CỦA: 
// - MovieCard (đã được sửa đổi để hiển thị ngang, xem phần 2 dưới đây)
// - getNumColumns (hoặc chỉ cần giữ itemWidth cố định)
// - getLanguageTagData, LanguageTag, LanguageBanner
// Của bạn vào VỊ TRÍ này trong file MovieListSection.js
// ************************************************

// --- API Endpoints ---
const API_LIST_FILM = (page) =>
  `https://phimapi.com/danh-sach/phim-moi-cap-nhat-v3?page=${page}&limit=10`; // Giới hạn 10 phim
const API_LIST_TYPE = (typeSlug) =>
  `https://phimapi.com/v1/api/danh-sach/${typeSlug}?page=1&limit=10`; // Giới hạn 10 phim

// ********** START: CHÈN CODE TIỆN ÍCH VÀ MOVIECARD Ở ĐÂY **********

// Vui lòng chèn các hàm MovieCard, LanguageTag, v.v. đã tối ưu cho horizontal list vào đây.
// Tôi sẽ định nghĩa lại MovieCard cho hiển thị ngang (horizontal) ngay dưới đây.

const MOVIE_CARD_WIDTH = 150; // Chiều rộng cố định cho hiển thị ngang

const getLanguageTagData = (lang) => {
    switch (lang.trim()) {
        case 'Vietsub': return { text: 'VSUB', icon: 'text-outline', color: '#00BFFF' };
        case 'Thuyết Minh': return { text: 'TM', icon: 'mic-outline', color: '#FFD700' };
        case 'Lồng Tiếng': return { text: 'LT', icon: 'volume-high-outline', color: '#FF4444' };
        default: return { text: lang.trim().toUpperCase(), icon: 'globe-outline', color: '#B0B0B0' };
    }
}

const LanguageTag = ({ lang }) => {
    const data = getLanguageTagData(lang);
    return (
        <View style={[styles.languageTag, { backgroundColor: data.color, marginRight: 3 }]}>
            <Ionicons name={data.icon} size={10} color="#121212" style={{ marginRight: 3 }} />
            <Text style={styles.languageTagText}>{data.text}</Text>
        </View>
    );
}

const LanguageBanner = ({ langString }) => {
    if (!langString) return null;

    const langItems = langString.split(' + ').map(s => s.trim()).filter(s => s.length > 0);
    if (langItems.length === 0) return null;

    const displayOrder = ['Vietsub', 'Thuyết Minh', 'Lồng Tiếng'];
    const sortedLang = langItems.sort((a, b) => {
        const indexA = displayOrder.indexOf(a);
        const indexB = displayOrder.indexOf(b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    return (
        <View style={styles.languageBannerContainer}>
            {sortedLang.map((lang, index) => (
                <LanguageTag key={index} lang={lang} />
            ))}
        </View>
    );
};

// MovieCard cho hiển thị NGANG (Horizontal)
const MovieCardHorizontal = React.memo(({ item, navigation, isHistoryMode }) => {

    const itemWidth = MOVIE_CARD_WIDTH;
    const gridPosterHeight = itemWidth * 1.5;

    const imageUrl = item.poster_url || item.thumb_url;
    const posterUrl = imageUrl?.startsWith('http')
                        ? imageUrl
                        : imageUrl ? `https://img.phimapi.com/${imageUrl}` : '';

    const movieName = item.name || item.movie?.name;

    return (
        <TouchableOpacity
            style={[styles.movieItemHorizontal, { width: itemWidth }]}
            onPress={() => navigation.navigate('Detail', { slug: item.slug || item.movie?.slug, movieName: movieName })}>

            <View style={styles.posterContainer}>
                <Image
                    source={{ uri: posterUrl }}
                    style={[styles.gridPoster, { height: gridPosterHeight }]}
                    resizeMode="cover"
                />

                {item.episode_current && (
                    <View style={styles.statusGridContainer}>
                        <Text style={styles.statusGridText} numberOfLines={1}>{item.episode_current}</Text>
                    </View>
                )}

                {item.lang && <LanguageBanner langString={item.lang} />}
            </View>

            <View style={styles.gridInfoContainer}>
                <Text style={styles.title} numberOfLines={2}>
                    {movieName}
                </Text>
                {/* Ẩn chi tiết chất lượng/năm để tiết kiệm không gian ngang */}
            </View>
        </TouchableOpacity>
    );
});


// ********** END: CHÈN CODE TIỆN ÍCH VÀ MOVIECARD Ở ĐÂY **********


const fetchHistoryMovies = async () => {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const historyKeys = keys.filter(key => key.startsWith('history_'));
        if (historyKeys.length === 0) return [];

        const historyData = await AsyncStorage.multiGet(historyKeys);

        const historyMovies = historyData
            .map(([key, value]) => {
                try {
                    const item = JSON.parse(value);
                    const { position, duration, episodeName, timestamp, movie } = item;

                    const watchSeconds = Math.floor(position / 1000); 
                    const durationSeconds = Math.floor(duration / 1000); 

                    const progressPercent = durationSeconds > 0 
                        ? Math.min(100, Math.floor((watchSeconds / durationSeconds) * 100))
                        : 0;

                    return {
                        ...movie, 
                        slug: movie.slug,
                        poster_url: movie.poster_url, 
                        thumb_url: movie.thumb_url,
                        last_watched_at: timestamp,
                        episode_current: `${episodeName || 'N/A'} - ${progressPercent}%`, 
                        lang: movie.lang || 'Vietsub', 
                    };
                } catch {
                    return null;
                }
            })
            .filter(item => item !== null)
            .sort((a, b) => b.last_watched_at - a.last_watched_at)
            .slice(0, 10); // Chỉ lấy 10 phim gần nhất cho Home

        return historyMovies;

    } catch (e) {
        console.error('Fetch History Error:', e);
        return [];
    }
};


export default function MovieListSection({ title, filter, navigation, viewAll }) {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let apiURL = null;
    let newItems = [];

    try {
        if (filter.type === 'history') {
            newItems = await fetchHistoryMovies();
        } else if (filter.type === 'type_list' || filter.type === 'default') {
            apiURL = filter.slug ? API_LIST_TYPE(filter.slug) : API_LIST_FILM(1);
            
            if (apiURL) {
                const response = await fetch(apiURL);
                const json = await response.json();

                if (json.status && json.data) {
                    newItems = json.data.items || [];
                } else if (json.items) {
                    newItems = json.items;
                }
            }
        }

        const processedItems = newItems.map(item => ({
            ...item,
            poster_url: item.poster_url || item.movie?.poster_url, 
            thumb_url: item.thumb_url || item.movie?.thumb_url,
            lang: item.lang || (item.movie?.lang || 'Vietsub') 
        }));

        setMovies(processedItems);

    } catch (e) {
      console.error(`Fetch Error for ${title}:`, e);
      setMovies([]);
    } finally {
      setLoading(false);
    }
  }, [filter.type, filter.slug, title]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    // Chỉ hiển thị loading nhỏ hoặc không hiển thị gì để tránh gián đoạn
    return (
        <View style={styles.sectionHeader}>
            <Text style={styles.titleText}>{title}</Text>
            <ActivityIndicator size="small" color="#FFD700" style={{ marginLeft: 10 }} />
        </View>
    );
  }

  if (movies.length === 0) {
    return null; // Không hiển thị section nếu không có dữ liệu
  }

  const renderItem = ({ item }) => (
    <MovieCardHorizontal item={item} navigation={navigation} isHistoryMode={filter.type === 'history'} />
  );

  return (
    <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
            <Text style={styles.titleText}>{title.toUpperCase()}</Text>
            <TouchableOpacity onPress={viewAll} style={styles.viewAllButton}>
                <Text style={styles.viewAllText}>Xem tất cả</Text>
                <Ionicons name="chevron-forward-outline" size={16} color="#B0B0B0" />
            </TouchableOpacity>
        </View>

        <FlatList
            horizontal
            data={movies}
            renderItem={renderItem}
            keyExtractor={(item) => item.slug || item.movie?.slug || item._id}
            contentContainerStyle={styles.horizontalList}
            showsHorizontalScrollIndicator={false}
        />
    </View>
  );
}

const styles = StyleSheet.create({
    sectionContainer: {
        paddingVertical: 10,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        marginBottom: 10,
    },
    titleText: {
        fontSize: 18,
        fontFamily: 'Roboto-Bold',
        color: '#FFFFFF',
    },
    viewAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    viewAllText: {
        fontSize: 14,
        color: '#B0B0B0',
        fontFamily: 'Roboto-Regular',
        marginRight: 2,
    },
    horizontalList: {
        paddingHorizontal: 10,
    },
    // ************************************************
    // STYLES CHO MOVIECARDHORIZONTAL
    // ************************************************
    movieItemHorizontal: {
        flexDirection: 'column', 
        backgroundColor: '#1E1E1E', 
        borderRadius: 8, 
        overflow: 'hidden', 
        marginHorizontal: 5,
        marginBottom: 5,
        elevation: 5, 
    },
    posterContainer: { position: 'relative' },
    gridPoster: { width: '100%' }, 
    gridInfoContainer: { padding: 8, justifyContent: 'flex-start', minHeight: 45 }, // Giảm minHeight
    title: { fontSize: 13, fontFamily: 'Roboto-Bold', color: '#FFFFFF', marginBottom: 2 }, // Giảm font size
    // Ẩn quality trong horizontal list
    
    // Status/Lang Tags (Giữ nguyên)
    statusGridContainer: {
        position: 'absolute', bottom: 0, right: 0,
        backgroundColor: 'rgba(255, 215, 0, 0.9)', 
        paddingHorizontal: 6, paddingVertical: 3, borderTopLeftRadius: 8, zIndex: 5,
    },
    statusGridText: {
        color: '#121212', fontSize: 10, fontFamily: 'Roboto-Bold',
    },
    languageBannerContainer: { 
        position: 'absolute', top: 5, left: 5, padding: 0, 
        flexDirection: 'row', alignItems: 'center', zIndex: 50,
    },
    languageTag: { 
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, 
    },
    languageTagText: { 
        color: '#121212', fontSize: 9, fontFamily: 'Roboto-Bold', lineHeight: 11, 
    },
});