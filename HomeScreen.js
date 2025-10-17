// HomeScreen.js (Phiên bản Tối Ưu, Thêm Lịch Sử Xem & Khôi phục Thanh Tìm kiếm)
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Image,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Keyboard,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage'; 

// ------------------- API ENDPOINTS (GIỮ NGUYÊN) -------------------
const API_GENRES = 'https://phimapi.com/the-loai';
const API_COUNTRIES = 'https://phimapi.com/quoc-gia';
const API_LIST_FILM = (page) =>
  `https://phimapi.com/danh-sach/phim-moi-cap-nhat-v3?page=${page}`;
const API_SEARCH = (keyword, page) =>
  `https://phimapi.com/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&page=${page}`;
const API_LIST_GENRE = (genreSlug, page) =>
  `https://phimapi.com/v1/api/the-loai/${genreSlug}?page=${page}`;
const API_LIST_COUNTRY = (countrySlug, page) =>
  `https://phimapi.com/v1/api/quoc-gia/${countrySlug}?page=${page}`; 

const DEFAULT_FILTER = { name: 'PHIM MỚI', slug: null, type: 'default' };
const HISTORY_FILTER = { name: 'ĐÃ XEM', slug: 'history', type: 'history' };

// Logic tính toán số cột dựa trên chiều rộng màn hình
const getNumColumns = (screenWidth) => {
  if (screenWidth >= 1024) { 
    return 4; 
  }
  if (screenWidth >= 768) { 
    return 3;
  }
  if (screenWidth > 480) { 
    return 2;
  }
  return 1; 
};

export default function HomeScreen({ navigation }) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const numColumns = getNumColumns(screenWidth); 

  // ------------------- STATE & LOGIC (Giữ nguyên) -------------------
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLoadMore, setIsLoadMore] = useState(false);
  const [page, setPage] = useState(1);
  const [isLastPage, setIsLastPage] = useState(false);
  const [error, setError] = useState(null);

  const [genres, setGenres] = useState([]);
  const [countries, setCountries] = useState([]);
  const [activeFilter, setActiveFilter] = useState(DEFAULT_FILTER);
  const [isGenreMenuVisible, setIsGenreMenuVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('genre'); 
  
  const [isSearching, setIsSearching] = useState(false);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    fetchFilters(); 
    fetchMoviesList(1, DEFAULT_FILTER); 
  }, []);

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
                    const watchTime = Math.floor(item.position / 60000); // phút
                    const durationTime = Math.floor(item.duration / 60000); // phút
                    const progressText = durationTime > 0 ? `${watchTime}p/${durationTime}p` : `${watchTime} phút`;
                    
                    return {
                        ...item.movie, 
                        last_watched_at: item.timestamp,
                        episode_current: `Đã xem Tập ${item.episodeName || 'N/A'} (${progressText})`,
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

  const fetchFilters = async () => {
    try {
      const [genresRes, countriesRes] = await Promise.all([
        fetch(API_GENRES),
        fetch(API_COUNTRIES)
      ]);
      const genresJson = await genresRes.json();
      const countriesJson = await countriesRes.json();
      if (Array.isArray(genresJson)) setGenres(genresJson);
      if (Array.isArray(countriesJson)) setCountries(countriesJson);
    } catch (e) {
      console.error('Fetch Filters Error:', e);
    }
  };

  const fetchMoviesList = async (pageToLoad, currentFilter, currentKeyword = '') => {
    if (pageToLoad === 1) {
      setLoading(true);
      setMovies([]);
      setError(null);
      setIsLastPage(false);
    } else {
      setIsLoadMore(true);
    }

    let apiURL;
    let newItems = [];
    let totalPages = 1;

    let isSearchMode = currentFilter.type === 'search';
    let isCountryMode = currentFilter.type === 'country';
    let isHistoryMode = currentFilter.type === 'history';
    
    if (isHistoryMode && pageToLoad === 1) { 
        newItems = await fetchHistoryMovies();
        setMovies(newItems);
        setIsLastPage(true);
        setLoading(false);
        setIsLoadMore(false);
        return;
    }

    // Logic gọi API
    // (Phần này giữ nguyên từ phiên bản trước)
    if (isSearchMode) {
      apiURL = API_SEARCH(currentKeyword, pageToLoad);
    } else if (currentFilter.type === 'genre') {
      apiURL = API_LIST_GENRE(currentFilter.slug, pageToLoad);
    } else if (isCountryMode) {
        apiURL = API_LIST_COUNTRY(currentFilter.slug, pageToLoad);
    } else if (currentFilter.type === 'default') {
      apiURL = API_LIST_FILM(pageToLoad); 
    } else {
        setLoading(false);
        setIsLoadMore(false);
        return; 
    }


    try {
      const response = await fetch(apiURL);
      const json = await response.json();

      if (isSearchMode || currentFilter.type === 'genre' || isCountryMode) {
        if (json.data && json.data.items) {
          newItems = json.data.items;
          totalPages = json.data.params.pagination.totalPages;
        }
      } else {
        if (json.items) {
          newItems = json.items;
          totalPages = json.pagination?.totalPages || 100;
        }
      }

      setMovies((prevMovies) => (pageToLoad === 1 ? newItems : [...prevMovies, ...newItems]));

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
    if (activeFilter.type === 'history') return; 

    if (!isLoadMore && !isLastPage) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchMoviesList(nextPage, activeFilter, keyword);
    }
  };

  const handleSearch = () => {
    Keyboard.dismiss();
    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) {
      clearSearch();
      return;
    }
    const searchFilter = { name: 'KẾT QUẢ TÌM KIẾM', slug: trimmedKeyword, type: 'search' };
    setActiveFilter(searchFilter); 
    setIsSearching(true);
    setPage(1);
    fetchMoviesList(1, searchFilter, trimmedKeyword);
  };

  const clearSearch = () => {
    setKeyword('');
    setIsSearching(false);
    setActiveFilter(DEFAULT_FILTER);
    setPage(1);
    fetchMoviesList(1, DEFAULT_FILTER);
    Keyboard.dismiss();
  };
  
  const handleFilterSelect = (item, type) => {
    Keyboard.dismiss();
    const newFilter = { name: item.name, slug: item.slug, type: type };
    setIsGenreMenuVisible(false); 
    setIsSearching(false);
    setKeyword('');
    setActiveFilter(newFilter);
    setPage(1);
    fetchMoviesList(1, newFilter);
  };

  // ------------------- RENDER FUNCTIONS -------------------
  
  const getHeaderTitle = () => {
    if (isSearching) {
        return `KẾT QUẢ CHO "${keyword.toUpperCase()}"`;
    }
    if (activeFilter.type === 'history') { 
        return 'PHIM ĐÃ XEM GẦN ĐÂY';
    }
    if (activeFilter.type === 'genre' || activeFilter.type === 'country') {
        return `LỌC THEO ${activeFilter.name.toUpperCase()}`;
    }
    return 'PHIM MỚI CẬP NHẬT';
  }

  const renderMovieItem = useCallback(({ item }) => {
    const isSingleColumn = numColumns === 1;

    const itemWidth = isSingleColumn ? screenWidth - 20 : (screenWidth - 20 - (numColumns * 10)) / numColumns;
    const gridPosterHeight = itemWidth * 1.5; // Tỉ lệ 2:3

    const posterUrl = item.thumb_url?.startsWith('http')
                        ? item.thumb_url
                        : `https://img.phimapi.com/${item.thumb_url}`;

    return (
        <TouchableOpacity
            style={[
                styles.movieItem,
                !isSingleColumn && styles.gridItem, 
                !isSingleColumn && { width: itemWidth } 
            ]}
            onPress={() => navigation.navigate('Detail', { slug: item.slug, movieName: item.name })}>
            <Image
                source={{ uri: posterUrl }}
                style={[
                    styles.poster,
                    !isSingleColumn && styles.gridPoster,
                    !isSingleColumn && { height: gridPosterHeight } 
                ]}
                resizeMode="cover"
            />
            <View style={[styles.infoContainer, !isSingleColumn && styles.gridInfoContainer]}>
                <Text style={styles.title} numberOfLines={isSingleColumn ? 2 : 3}>
                    {item.name}
                </Text>
                <Text style={styles.episode}>
                    Trạng thái: {item.episode_current || 'N/A'}
                </Text>
                <Text style={styles.quality}>Năm: {item.year} | Chất lượng: {item.quality || 'HD'}</Text>
            </View>
        </TouchableOpacity>
    );
  }, [numColumns, screenWidth, navigation]);
  
  const renderFilterMenu = () => {
    if (!isGenreMenuVisible) return null;
    
    const currentList = activeTab === 'genre' ? genres : countries;
    const currentType = activeTab === 'genre' ? 'genre' : 'country';
    const currentActiveSlug = activeFilter.type === currentType ? activeFilter.slug : null;

    const menuWidth = screenWidth * 0.9; 

    return (
      <View style={styles.genreMenuOverlay}>
        <View style={[styles.genreMenuContainer, { width: menuWidth }]}>
          <Text style={styles.menuTitle}>CHỌN BỘ LỌC</Text>
          <View style={styles.tabContainer}>
            <TouchableOpacity 
                style={[styles.tabButton, activeTab === 'genre' && styles.activeTabButton]}
                onPress={() => setActiveTab('genre')}
            >
                <Text style={[styles.tabButtonText, activeTab === 'genre' && styles.activeTabButtonText]}>THỂ LOẠI</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.tabButton, activeTab === 'country' && styles.activeTabButton]}
                onPress={() => setActiveTab('country')}
            >
                <Text style={[styles.tabButtonText, activeTab === 'country' && styles.activeTabButtonText]}>QUỐC GIA</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView contentContainerStyle={styles.genreList} style={{ maxHeight: screenHeight * 0.6 }}> 
            
            {activeTab === 'genre' && (
                <TouchableOpacity
                    key={'history_filter'}
                    style={[
                        styles.genreButton,
                        activeFilter.type === 'history' && styles.selectedGenreButton,
                    ]}
                    onPress={() => handleFilterSelect(HISTORY_FILTER, 'history')}
                >
                    <Text
                        style={[
                            styles.genreButtonText,
                            activeFilter.type === 'history' && styles.selectedGenreButtonText,
                        ]}
                    >
                        ❤️ Phim Đã Xem
                    </Text>
                </TouchableOpacity>
            )}

            {activeTab === 'genre' && (
                <TouchableOpacity
                    key={'default_filter'}
                    style={[
                        styles.genreButton,
                        activeFilter.type === 'default' && styles.selectedGenreButton,
                    ]}
                    onPress={() => handleFilterSelect(DEFAULT_FILTER, 'default')}
                >
                    <Text
                        style={[
                            styles.genreButtonText,
                            activeFilter.type === 'default' && styles.selectedGenreButtonText,
                        ]}
                    >
                        Phim Mới Cập Nhật
                    </Text>
                </TouchableOpacity>
            )}

            {currentList.map((item) => (
              <TouchableOpacity
                key={item.slug}
                style={[
                  styles.genreButton,
                  currentActiveSlug === item.slug && styles.selectedGenreButton,
                ]}
                onPress={() => handleFilterSelect(item, currentType)}
              >
                <Text
                  style={[
                    styles.genreButtonText,
                    currentActiveSlug === item.slug && styles.selectedGenreButtonText,
                  ]}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={styles.closeMenuButton}
            onPress={() => setIsGenreMenuVisible(false)}
          >
            <Text style={styles.closeMenuButtonText}>Đóng</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderFooter = () => {
    if (activeFilter.type === 'history') return <View style={{ height: 30 }} />; 
    
    if (isLoadMore) {
        return (
            <View style={styles.footerContainer}>
            <ActivityIndicator size="small" color="#FFD700" />
            <Text style={styles.loadingText}>Đang tải thêm...</Text>
            </View>
        );
    }
    if (isLastPage && movies.length > 0) {
        return (
            <View style={styles.footerContainer}>
            <Text style={styles.noMoreText}>--- Đã tải hết kết quả ---</Text>
            </View>
        );
    }
    return <View style={{ height: 30 }} />;
  };

  // ------------------- JSX RENDER CHÍNH (Đã khôi phục thanh tìm kiếm) -------------------
  if (loading && movies.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        <Text style={styles.header}>
          🎬 {getHeaderTitle()} 🍿
        </Text>
      </View>

      <View style={styles.controlBar}>
        {/* === THANH TÌM KIẾM ĐÃ KHÔI PHỤC === */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm phim..."
            placeholderTextColor="#B0B0B0"
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {keyword.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>X</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleSearch} style={styles.searchButton}>
            <Text style={styles.searchButtonText}>🔍</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
            onPress={() => setIsGenreMenuVisible(true)} 
            style={styles.genreButtonToggle}
        >
            <Text style={styles.genreButtonToggleText}>LỌC</Text>
        </TouchableOpacity>
      </View>
      
      {movies.length === 0 && !loading ? (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>
            {activeFilter.type === 'history' ? 'Bạn chưa xem phim nào.' : (error || `Không tìm thấy kết quả nào.`)}
          </Text>
          <TouchableOpacity onPress={() => fetchMoviesList(1, DEFAULT_FILTER)} style={styles.retryButton}>
             <Text style={styles.retryButtonText}>Xem phim mới nhất</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={movies}
          renderItem={renderMovieItem}
          keyExtractor={(item) => item.slug || item._id} 
          contentContainerStyle={styles.list}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          key={numColumns} 
          numColumns={numColumns} 
          columnWrapperStyle={numColumns > 1 && styles.row}
        />
      )}
      
      {renderFilterMenu()}
    </SafeAreaView>
  );
}

// ------------------- STYLES (Giữ nguyên) -------------------
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#121212' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
    loadingText: { color: '#FFFFFF', marginTop: 10 },
    headerContainer: { paddingTop: 15, paddingHorizontal: 10, backgroundColor: '#1E1E1E' },
    header: { fontSize: 18, fontWeight: 'bold', color: '#FFD700', textAlign: 'center', paddingBottom: 10 },
    controlBar: { flexDirection: 'row', padding: 10, backgroundColor: '#1E1E1E', borderBottomWidth: 1, borderBottomColor: '#333' },
    searchContainer: { flex: 1, flexDirection: 'row' },
    searchInput: { flex: 1, height: 40, backgroundColor: '#2E2E2E', borderRadius: 8, paddingHorizontal: 15, color: '#FFFFFF', marginRight: 8 },
    searchButton: { backgroundColor: '#FFD700', width: 40, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    searchButtonText: { fontSize: 18 },
    clearButton: { position: 'absolute', right: 50, top: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: 5, zIndex: 10 },
    clearButtonText: { color: '#B0B0B0', fontWeight: 'bold', fontSize: 16 },
    genreButtonToggle: { backgroundColor: '#00BFFF', width: 80, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
    genreButtonToggleText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
    list: { paddingHorizontal: 5, paddingTop: 10 }, 
    movieItem: { flexDirection: 'row', backgroundColor: '#1E1E1E', marginBottom: 10, borderRadius: 8, overflow: 'hidden', elevation: 5, marginHorizontal: 5 }, 
    poster: { width: 100, height: 150 },
    infoContainer: { flex: 1, padding: 10, justifyContent: 'center' },
    title: { fontSize: 16, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 5 },
    episode: { fontSize: 14, color: '#B0B0B0', marginBottom: 3 },
    quality: { fontSize: 14, color: '#00FF7F', fontWeight: '500' },
    row: { justifyContent: 'flex-start', marginBottom: 10 }, 
    gridItem: { flexDirection: 'column', backgroundColor: '#1E1E1E', borderRadius: 8, overflow: 'hidden', elevation: 5, marginHorizontal: 5, marginBottom: 10 },
    gridPoster: { width: '100%', height: 250 }, 
    gridInfoContainer: { padding: 8, justifyContent: 'flex-start', minHeight: 80 },
    gridYear: { fontSize: 12, color: '#B0B0B0', marginTop: 5 },
    footerContainer: { paddingVertical: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    noMoreText: { color: '#B0B0B0', fontSize: 14 },
    noDataContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    noDataText: { color: '#FFFFFF', fontSize: 16, textAlign: 'center', marginBottom: 15 },
    retryButton: { backgroundColor: '#FFD700', padding: 10, borderRadius: 5 },
    retryButtonText: { color: '#121212', fontWeight: 'bold' },
    genreMenuOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
    genreMenuContainer: { maxHeight: '80%', backgroundColor: '#1E1E1E', borderRadius: 10, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 10 },
    menuTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFD700', textAlign: 'center', marginBottom: 15, borderBottomWidth: 2, borderBottomColor: '#333', paddingBottom: 10 },
    tabContainer: { flexDirection: 'row', marginBottom: 15, backgroundColor: '#383838', borderRadius: 8, overflow: 'hidden' },
    tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#383838' },
    activeTabButton: { backgroundColor: '#00BFFF', borderColor: '#00BFFF' },
    tabButtonText: { color: '#FFFFFF', fontWeight: 'bold' },
    activeTabButtonText: { color: '#121212' },
    genreList: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
    genreButton: { backgroundColor: '#383838', paddingVertical: 10, paddingHorizontal: 15, margin: 6, borderRadius: 20, borderWidth: 1, borderColor: '#555' },
    selectedGenreButton: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
    genreButtonText: { color: '#FFFFFF', fontWeight: '600' },
    selectedGenreButtonText: { color: '#121212', fontWeight: 'bold' },
    closeMenuButton: { marginTop: 20, backgroundColor: '#555', padding: 12, borderRadius: 8, alignItems: 'center' },
    closeMenuButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
});
