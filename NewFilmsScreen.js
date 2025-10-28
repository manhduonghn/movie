// NewFilmsScreen.js (Dùng chung cho Phim Mới, Lịch sử, Search, MovieList)
import React, { useState, useEffect, useCallback, memo, useLayoutEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  Keyboard,
  ScrollView,
  useWindowDimensions,
  Alert,
  Platform, 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { Ionicons } from '@expo/vector-icons'; 
import { SafeAreaView } from 'react-native-safe-area-context'; 

// --- API Endpoints ---
const API_LIST_FILM = (page) =>
  `https://phimapi.com/danh-sach/phim-moi-cap-nhat-v3?page=${page}`;
const API_SEARCH = (keyword, page) =>
  `https://phimapi.com/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&page=${page}`;
const API_LIST_GENRE = (genreSlug, page) =>
  `https://phimapi.com/v1/api/the-loai/${genreSlug}?page=${page}`;
const API_LIST_COUNTRY = (countrySlug, page) =>
  `https://phimapi.com/v1/api/quoc-gia/${countrySlug}?page=${page}`; 
const API_LIST_TYPE = (typeSlug, page) =>
  `https://phimapi.com/v1/api/danh-sach/${typeSlug}?page=${page}`;

const DEFAULT_FILTER = { name: 'PHIM MỚI CẬP NHẬT', slug: null, type: 'default' };
const HISTORY_FILTER = { name: 'LỊCH SỬ ĐÃ XEM', slug: 'history', type: 'history' };

// --- Utility Functions & Components (MovieCard, LanguageBanner) (Giữ nguyên) ---
// (Bạn cần chèn các hàm getNumColumns, getLanguageTagData, LanguageTag, LanguageBanner và MovieCard từ code cũ vào đây)
// ... (Code của các component tiện ích: getNumColumns, getLanguageTagData, LanguageTag, LanguageBanner, MovieCard)
// Để tiết kiệm không gian, tôi chỉ để lại thân hàm chính. Hãy chắc chắn bạn chèn chúng vào file NewFilmsScreen.js.

const getNumColumns = (screenWidth) => {
    if (screenWidth >= 1200) return 5; 
    if (screenWidth >= 1024) return 4; 
    if (screenWidth >= 768) return 3; 
    if (screenWidth > 480) return 2; 
    return 2; 
};

// ********** BẮT ĐẦU CHÈN CODE TIỆN ÍCH **********

const getLanguageTagData = (lang) => {
    switch (lang.trim()) {
        case 'Vietsub':
            return { text: 'VSUB', icon: 'text-outline', color: '#00BFFF' }; 
        case 'Thuyết Minh':
            return { text: 'TM', icon: 'mic-outline', color: '#FFD700' }; 
        case 'Lồng Tiếng':
            return { text: 'LT', icon: 'volume-high-outline', color: '#FF4444' }; 
        default:
            return { text: lang.trim().toUpperCase(), icon: 'globe-outline', color: '#B0B0B0' };
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

    if (langItems.length === 0) {
        return null;
    }

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

const MovieCard = memo(({ item, numColumns, screenWidth, navigation, isHistoryMode, onRemoveHistory }) => {

    const itemMargin = 8; 
    const itemWidth = (screenWidth - 20 - (numColumns * itemMargin)) / numColumns;

    const gridPosterHeight = itemWidth * 1.5; 

    const imageUrl = item.poster_url || item.thumb_url;

    const posterUrl = imageUrl?.startsWith('http')
                        ? imageUrl

                        : imageUrl ? `https://img.phimapi.com/${imageUrl}` : '';

    const movieName = item.name || item.movie?.name; 

    return (
        <TouchableOpacity
            style={[
                styles.movieItem,
                styles.gridItem, 
                { width: itemWidth, marginHorizontal: itemMargin / 2 }
            ]}
            onPress={() => navigation.navigate('Detail', { slug: item.slug || item.movie?.slug, movieName: movieName })}>

            <View style={styles.posterContainer}>
                <Image
                    source={{ uri: posterUrl }}
                    style={[
                        styles.gridPoster,
                        { height: gridPosterHeight } 
                    ]}
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
                <Text style={styles.quality}>
                    {item.year ? `${item.year} | ` : ''} {item.quality || 'HD'}
                </Text>
            </View>

            {isHistoryMode && (
                <TouchableOpacity
                    style={styles.removeButtonGrid}
                    onPress={() => onRemoveHistory(item.slug || item.movie?.slug, movieName)}
                >
                    <Ionicons name="close-circle" size={24} color="#FF4444" />
                </TouchableOpacity>
            )}

        </TouchableOpacity>
    );
});

// ********** KẾT THÚC CHÈN CODE TIỆN ÍCH **********


export default function NewFilmsScreen({ navigation, route }) {
  const { width: screenWidth } = useWindowDimensions();
  const numColumns = getNumColumns(screenWidth); 

  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLoadMore, setIsLoadMore] = useState(false);
  const [page, setPage] = useState(1);
  const [isLastPage, setIsLastPage] = useState(false);
  const [error, setError] = useState(null);

  const [isSearchInputVisible, setIsSearchInputVisible] = useState(false); 
  const [keyword, setKeyword] = useState('');
  const [isSearching, setIsSearching] = useState(false); 

  // Xác định bộ lọc ban đầu dựa trên Route params
  const initialFilter = route.params?.filter || DEFAULT_FILTER;
  const [activeFilter, setActiveFilter] = useState(initialFilter);

  // Cập nhật filter khi route params thay đổi
  useEffect(() => {
    if (route.params?.filter) {
        setActiveFilter(route.params.filter);
        setPage(1);
        fetchMoviesList(1, route.params.filter, route.params.filter.type === 'search' ? route.params.filter.slug : '');
    }
  }, [route.params?.filter]);


  const clearSearch = useCallback(() => {
    setKeyword('');
    setIsSearching(false);
    if (activeFilter.type === 'search') { 
        setActiveFilter(DEFAULT_FILTER);
        setPage(1);
        fetchMoviesList(1, DEFAULT_FILTER); 
    }
    Keyboard.dismiss();
  }, [activeFilter.type]);

  const toggleSearch = useCallback(() => {
    setIsSearchInputVisible(prev => {
        const nextState = !prev;
        if (prev) {
            clearSearch();
        }
        return nextState;
    });
  }, [clearSearch]);

  const handleSearch = useCallback(() => {
    Keyboard.dismiss();
    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) {
      setIsSearchInputVisible(false); 
      clearSearch();
      return;
    }
    const searchFilter = { name: 'KẾT QUẢ TÌM KIẾM', slug: trimmedKeyword, type: 'search' };
    setActiveFilter(searchFilter); 
    setIsSearching(true);
    setPage(1);
    fetchMoviesList(1, searchFilter, trimmedKeyword);
  }, [keyword]);
  
  // Set Header Title & Search Icon
  useLayoutEffect(() => {
    const screenTitle = route.params?.title || activeFilter.name;

    navigation.setOptions({
        title: screenTitle,
        headerShown: true,
        headerStyle: { backgroundColor: '#1E1E1E' },
        headerTintColor: '#FFD700',

        // Hiển thị nút search chỉ khi không phải là Route Lịch sử hoặc Route chung khác
        headerRight: () => {
            if (activeFilter.type === 'history') return null;

            return (
                <TouchableOpacity onPress={toggleSearch} style={{ paddingLeft: 10 }}>
                    <Ionicons 
                        name={isSearchInputVisible ? "close-circle" : "search"} 
                        size={24} 
                        color="#FFD700" 
                    />
                </TouchableOpacity>
            );
        },
    });

  }, [navigation, toggleSearch, isSearchInputVisible, activeFilter.name, activeFilter.type, route.params?.title]);

  // Initial Data Fetch
  useEffect(() => {
    if (!route.params?.filter) {
      fetchMoviesList(1, DEFAULT_FILTER); 
    } else {
        fetchMoviesList(1, initialFilter, initialFilter.type === 'search' ? initialFilter.slug : '');
    }
  }, []);

  const fetchHistoryMovies = async () => {
    // Logic fetchHistoryMovies (Giữ nguyên)
    // ...
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
                        history_key: key, 
                        episode_current: `${episodeName || 'N/A'} - Đã xem ${progressPercent}%`, 
                        lang: movie.lang || 'Vietsub', 
                    };
                } catch {
                    return null;
                }
            })
            .filter(item => item !== null)
            .sort((a, b) => b.last_watched_at - a.last_watched_at); 

        return historyMovies;

    } catch (e) {
        console.error('Fetch History Error:', e);
        return [];
    }
  };

  const handleRemoveFromHistory = useCallback(async (slug, movieName) => {
    Alert.alert(
      "Xác nhận xóa",
      `Bạn có chắc chắn muốn xóa "${movieName}" khỏi lịch sử xem không?`,
      [
        { text: "Hủy", style: "cancel" },
        { 
          text: "Xóa", 
          onPress: async () => {
            try {
              const historyKey = `history_${slug}`;
              await AsyncStorage.removeItem(historyKey);

              setMovies(prevMovies => prevMovies.filter(movie => (movie.slug || movie.movie?.slug) !== slug));

            } catch (e) {
              console.error('Error removing from history:', e);
              Alert.alert("Lỗi", "Không thể xóa lịch sử xem.");
            }
          },
          style: 'destructive'
        }
      ]
    );
  }, []); 

  const fetchMoviesList = async (pageToLoad, currentFilter, currentKeyword = '') => {

    if (pageToLoad === 1) { 
        setLoading(true);
        setMovies([]);
        setError(null);
        setIsLastPage(false);
        setIsLoadMore(false);
    } else {
        setIsLoadMore(true);
    }

    let apiURL = null;
    let isHistoryMode = currentFilter.type === 'history';

    if (isHistoryMode) { 
        const newItems = await fetchHistoryMovies();
        setMovies(newItems);
        setIsLastPage(true);
        setLoading(false);
        setIsLoadMore(false);
        return;
    }

    if (currentFilter.type === 'search') {
      apiURL = API_SEARCH(currentKeyword, pageToLoad);
    } else if (currentFilter.type === 'genre') {
      apiURL = API_LIST_GENRE(currentFilter.slug, pageToLoad);
    } else if (currentFilter.type === 'country') {
      apiURL = API_LIST_COUNTRY(currentFilter.slug, pageToLoad);
    } else if (currentFilter.type === 'type_list') { 
      apiURL = API_LIST_TYPE(currentFilter.slug, pageToLoad);
    } else if (currentFilter.type === 'default') {
      apiURL = API_LIST_FILM(pageToLoad); 
    }

    if (!apiURL) {
        setLoading(false);
        setIsLoadMore(false);
        return;
    }

    try {
      const response = await fetch(apiURL);
      const json = await response.json();

      let newItems = [];
      let totalPages = 1;

      if (json.status && json.data) {
        newItems = json.data.items || [];
        totalPages = json.data.params?.pagination?.totalPages || 1;
      } else if (json.items) {
        newItems = json.items;
        totalPages = json.pagination?.totalPages || 100;
      } else {
         throw new Error('Dữ liệu API không hợp lệ.');
      }

      const processedItems = newItems.map(item => ({
          ...item,
          poster_url: item.poster_url || item.movie?.poster_url, 
          thumb_url: item.thumb_url || item.movie?.thumb_url,
          lang: item.lang || (item.movie?.lang || 'Vietsub') 
      }));

      setMovies((prevMovies) => (pageToLoad === 1 ? processedItems : [...prevMovies, ...processedItems]));

      if (pageToLoad >= totalPages || newItems.length === 0) {
        setIsLastPage(true);
      }
    } catch (e) {
      console.error('Fetch Error:', e);
      setError('Lỗi kết nối hoặc xử lý dữ liệu.');
    } finally {
      setLoading(false);
      setIsLoadMore(false);
    }
  };

  const handleLoadMore = () => {
    if (activeFilter.type === 'history' || loading || isLoadMore || isLastPage) return; 

    const nextPage = page + 1;
    setPage(nextPage);
    fetchMoviesList(nextPage, activeFilter, activeFilter.type === 'search' ? activeFilter.slug : ''); 
  };

  const renderMovieItem = useCallback(({ item }) => {
    return (
      <MovieCard 
        item={item} 
        numColumns={numColumns} 
        screenWidth={screenWidth} 
        navigation={navigation} 
        isHistoryMode={activeFilter.type === 'history'}
        onRemoveHistory={handleRemoveFromHistory}
      />
    );
  }, [numColumns, screenWidth, navigation, activeFilter.type, handleRemoveFromHistory]);

  const renderFooter = () => {
    if (activeFilter.type === 'history') return <View style={{ height: 30 }} />; 

    if (isLoadMore && page > 1) { 
        return (
            <View style={styles.footerContainer}>
            <ActivityIndicator size="small" color="#FFD700" />
            <Text style={styles.loadingTextFooter}>Đang tải thêm...</Text>
            </View>
        );
    }
    if (isLastPage && movies.length > 0) {
        return (
            <View style={styles.footerContainer}>
            <Text style={styles.noMoreText}>--- 🎬 Hết phim rồi, xem phim khác nhé! ---</Text>
            </View>
        );
    }
    return <View style={{ height: 30 }} />;
  };

  return (
    <View style={styles.container}>

        {/* Search Input */}
        {isSearchInputVisible && (
            <View style={styles.searchBarBody}>
                <TextInput
                    style={styles.searchInputBody}
                    placeholder="Nhập tên phim để tìm kiếm..."
                    placeholderTextColor="#B0B0B0" 
                    value={keyword}
                    onChangeText={setKeyword}
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                    autoFocus={true} 
                />
                {keyword.length > 0 && (
                    <TouchableOpacity onPress={clearSearch} style={styles.clearButtonBody}>
                      <Ionicons name="close-circle" size={20} color="#B0B0B0" />
                    </TouchableOpacity>
                )}
                <TouchableOpacity onPress={handleSearch} style={styles.searchButtonBody}>
                  <Ionicons name="search" size={20} color="#121212" />
                </TouchableOpacity>
            </View>
        )}

        <View style={styles.headerContainer}>
            <Text style={styles.header}>
                {isSearching ? `KẾT QUẢ TÌM KIẾM: "${keyword.toUpperCase()}"` : activeFilter.name.toUpperCase()}
            </Text>
        </View>

        <FlatList
            data={movies}
            renderItem={renderMovieItem}
            keyExtractor={(item) => item.slug || item.movie?.slug || item._id} 
            contentContainerStyle={styles.list}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
            key={numColumns} 
            numColumns={numColumns} 
            columnWrapperStyle={numColumns > 1 && styles.row}
        />

        {loading && movies.length === 0 && (
            <View style={styles.initialLoadingOverlay}>
                <ActivityIndicator size="large" color="#FFD700" />
                <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
            </View>
        )}

        {movies.length === 0 && !loading && ( 
            <View style={styles.contentOverlay}>
              <Ionicons name="sad-outline" size={40} color="#B0B0B0" />
              <Text style={styles.noDataText}>
                {activeFilter.type === 'history' ? 'Bạn chưa xem phim nào.' : (error || `Không tìm thấy kết quả nào cho "${activeFilter.name}".`)}
              </Text>
              {activeFilter.type !== 'default' && activeFilter.type !== 'history' && (
                 <TouchableOpacity onPress={() => navigation.navigate('NewFilms')} style={styles.retryButton}>
                    <Text style={styles.retryButtonText}>🎥 Xem Phim Mới Nhất</Text>
                 </TouchableOpacity>
              )}
            </View>
        )}
    </View>
  );
}

// Styles (Giữ nguyên)
// ... (Bạn cần chèn code styles từ file cũ vào đây)
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#121212' }, 
    contentOverlay: { 
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212', zIndex: 40,
    },
    initialLoadingOverlay: { 
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(18, 18, 18, 0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 50, 
    },
    loadingText: { color: '#FFFFFF', marginTop: 10, fontFamily: 'Roboto-Regular', fontSize: 16 }, 
    loadingTextFooter: { color: '#FFFFFF', marginLeft: 10, fontFamily: 'Roboto-Regular', fontSize: 14 },

    searchBarBody: { 
        flexDirection: 'row', 
        padding: 10, 
        backgroundColor: '#1E1E1E', 
        alignItems: 'center', 
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    searchInputBody: { 
        flex: 1, 
        height: 40, 
        backgroundColor: '#2E2E2E', 
        borderRadius: 20, 
        paddingHorizontal: 15, 
        color: '#FFFFFF', 
        marginRight: 8, 
        fontFamily: 'Roboto-Regular' 
    },
    clearButtonBody: { position: 'absolute', right: 58, top: 10, bottom: 10, justifyContent: 'center', paddingHorizontal: 5, zIndex: 10 },
    searchButtonBody: { 
        backgroundColor: '#FFD700', 
        width: 40, 
        height: 40, 
        borderRadius: 20, 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    headerContainer: { 
        paddingVertical: 10, 
        paddingHorizontal: 15, 
        backgroundColor: '#121212', 
        minHeight: 40, 
    },
    header: { 
        fontSize: 18, 
        fontFamily: 'Roboto-Bold', 
        color: '#00BFFF', 
        textAlign: 'center' 
    }, 
    list: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 60 }, 
    row: { justifyContent: 'flex-start', marginBottom: 10, marginHorizontal: -5 }, 
    gridItem: { 
        flexDirection: 'column', 
        backgroundColor: '#1E1E1E', 
        borderRadius: 8, 
        overflow: 'hidden', 
        marginBottom: 10,
        elevation: 5, 
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
            }
        })
    },
    posterContainer: { position: 'relative' },
    gridPoster: { width: '100%' }, 
    gridInfoContainer: { padding: 8, justifyContent: 'flex-start', minHeight: 65 },
    title: { fontSize: 14, fontFamily: 'Roboto-Bold', color: '#FFFFFF', marginBottom: 2 },
    quality: { fontSize: 12, color: '#00FF7F', fontFamily: 'Roboto-Regular' }, 
    statusGridContainer: {
        position: 'absolute',
        bottom: 0, 
        right: 0,
        backgroundColor: 'rgba(255, 215, 0, 0.9)', 
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderTopLeftRadius: 8,
        zIndex: 5,
    },
    statusGridText: {
        color: '#121212', 
        fontSize: 11,
        fontFamily: 'Roboto-Bold',
    },
    languageBannerContainer: { 
        position: 'absolute', 
        top: 5, 
        left: 5, 
        padding: 5, 
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 50,
    },
    languageTag: { 
        flexDirection: 'row', 
        alignItems: 'center',
        paddingHorizontal: 5, 
        paddingVertical: 2, 
        borderRadius: 3, 
    },
    languageTagText: { 
        color: '#121212', 
        fontSize: 10, 
        fontFamily: 'Roboto-Bold',
        lineHeight: 12, 
    },
    footerContainer: { paddingVertical: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    noMoreText: { color: '#B0B0B0', fontSize: 14, fontFamily: 'Roboto-Regular' },
    noDataText: { color: '#FFFFFF', fontSize: 16, textAlign: 'center', marginVertical: 15, fontFamily: 'Roboto-Regular' },
    retryButton: { backgroundColor: '#FFD700', padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', marginTop: 15 }, 
    retryButtonText: { color: '#121212', fontFamily: 'Roboto-Bold', fontSize: 15, marginLeft: 5 },
    removeButtonGrid: { 
        position: 'absolute', 
        top: 5, 
        right: 5, 
        zIndex: 10,
        backgroundColor: 'rgba(18, 18, 18, 0.7)', 
        borderRadius: 15
    },
});
