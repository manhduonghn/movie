import React, { useState, useEffect, useCallback, memo, useLayoutEffect } from 'react';
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
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { Ionicons } from '@expo/vector-icons'; 

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


// Logic tính toán số cột dựa trên chiều rộng màn hình (GIỮ NGUYÊN)
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

// ------------------- MOVIE CARD COMPONENT (GIỮ NGUYÊN) -------------------
const MovieCard = memo(({ item, numColumns, screenWidth, navigation, isHistoryMode, onRemoveHistory }) => {
    const isSingleColumn = numColumns === 1;

    const itemPadding = 10;
    const itemMargin = 10;
    const itemWidth = isSingleColumn 
      ? screenWidth - itemPadding * 2
      : (screenWidth - itemPadding * 2 - (numColumns > 0 ? numColumns * itemMargin : 0)) / numColumns;
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
                
                {/* NÚT XÓA LỊCH SỬ XEM */}
                {isHistoryMode && isSingleColumn && (
                    <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => onRemoveHistory(item.slug, item.name)}
                    >
                        <Text style={styles.removeButtonText}>🗑️ Xóa</Text>
                    </TouchableOpacity>
                )}
            </View>
            
            {/* NÚT XÓA TRÊN GRID (Nếu cần) */}
            {isHistoryMode && !isSingleColumn && (
                <TouchableOpacity
                    style={styles.removeButtonGrid}
                    onPress={() => onRemoveHistory(item.slug, item.name)}
                >
                    <Text style={styles.removeButtonGridText}>X</Text>
                </TouchableOpacity>
            )}

        </TouchableOpacity>
    );
});

export default function HomeScreen({ navigation, route }) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const numColumns = getNumColumns(screenWidth); 

  // ------------------- STATE & LOGIC -------------------
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLoadMore, setIsLoadMore] = useState(false);
  const [page, setPage] = useState(1);
  const [isLastPage, setIsLastPage] = useState(false);
  const [error, setError] = useState(null);

  const [genres, setGenres] = useState([]);
  const [countries, setCountries] = useState([]);
  const [activeFilter, setActiveFilter] = useState(DEFAULT_FILTER); 
  const [isGenreCountryMenuVisible, setIsGenreCountryMenuVisible] = useState(false); 
  const [activeTab, setActiveTab] = useState('genre'); 
  
  const [isSearchInputVisible, setIsSearchInputVisible] = useState(false); 
  const [keyword, setKeyword] = useState('');
  const [isSearching, setIsSearching] = useState(false); 

  // ------------------- LOGIC CHO HEADER SEARCH -------------------
  const clearSearch = () => {
    setKeyword('');
    setIsSearching(false);
    if (activeFilter.type !== 'default') { 
        setActiveFilter(DEFAULT_FILTER);
        setPage(1);
        fetchMoviesList(1, DEFAULT_FILTER);
    }
    Keyboard.dismiss();
  };

  const toggleSearch = useCallback(() => {
    setIsSearchInputVisible(prev => {
        const nextState = !prev;
        if (prev) {
            clearSearch();
        }
        setIsGenreCountryMenuVisible(false); 
        return nextState;
    });
  }, [activeFilter.type]);

  useLayoutEffect(() => {
    navigation.setParams({ 
        toggleSearch: toggleSearch,
        isSearchInputVisible: isSearchInputVisible, 
    });
  }, [navigation, toggleSearch, isSearchInputVisible]);
  
  // ------------------- useEffects & FETCH API (GIỮ NGUYÊN) -------------------
  useEffect(() => {
    fetchFilters(); 
    fetchMoviesList(1, DEFAULT_FILTER); 
  }, []);

  const fetchHistoryMovies = async () => {
    // ... (logic fetchHistoryMovies giữ nguyên)
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

                    const watchMinutes = Math.floor(position / 60000); 
                    const durationMinutes = Math.floor(duration / 60000); 
                    
                    const progressText = durationMinutes > 0 
                        ? `${watchMinutes}p/${durationMinutes}p` 
                        : `${watchMinutes} phút`;
                    
                    return {
                        ...movie, 
                        last_watched_at: timestamp,
                        history_key: key, 
                        episode_current: `Đã xem Tập ${episodeName || 'N/A'} (${progressText})`,
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

  const handleRemoveFromHistory = useCallback((slug, movieName) => {
    Alert.alert(
      "Xác nhận xóa",
      `Bạn có chắc chắn muốn xóa "${movieName}" khỏi lịch sử xem không?`,
      [
        {
          text: "Hủy",
          style: "cancel"
        },
        { 
          text: "Xóa", 
          onPress: async () => {
            try {
              const historyKey = `history_${slug}`;
              await AsyncStorage.removeItem(historyKey);
              
              setMovies(prevMovies => prevMovies.filter(movie => movie.slug !== slug));
              
              if (movies.length === 1) { 
                  setMovies([]); 
              }
            } catch (e) {
              console.error('Error removing from history:', e);
              Alert.alert("Lỗi", "Không thể xóa lịch sử xem.");
            }
          },
          style: 'destructive'
        }
      ]
    );
  }, [movies.length]); 
  
  const fetchFilters = async () => { /* ... giữ nguyên ... */
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
    // Không cần xử lý placeholder vì không còn dùng nữa
    
    if (pageToLoad === 1) { 
      setLoading(true);
      setMovies([]);
      setError(null);
      setIsLastPage(false);
    } else {
      setIsLoadMore(true);
    }

    let apiURL = null;
    let isHistoryMode = currentFilter.type === 'history';
    
    if (isHistoryMode && pageToLoad === 1) { 
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

  // ------------------- HANDLERS -------------------
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
      setIsSearchInputVisible(false);
      clearSearch();
      return;
    }
    const searchFilter = { name: 'KẾT QUẢ TÌM KIẾM', slug: trimmedKeyword, type: 'search' };
    setActiveFilter(searchFilter); 
    setIsSearching(true);
    setIsGenreCountryMenuVisible(false); 
    setPage(1);
    fetchMoviesList(1, searchFilter, trimmedKeyword);
  };
  
  const handleFilterSelect = (item, type) => {
    Keyboard.dismiss();
    const newFilter = { name: item.name, slug: item.slug, type: type };
    
    // **Chỉ ẩn menu lọc khi người dùng chọn một mục trong menu**
    setIsGenreCountryMenuVisible(false); 
    
    setIsSearchInputVisible(false); 
    setIsSearching(false);
    setKeyword('');

    setActiveFilter(newFilter);
    setPage(1);
    fetchMoviesList(1, newFilter); 
  };
  
  // Hàm xử lý việc mở/đóng menu lọc từ FilterBar
  const handleToggleMenu = (tab) => {
      // Đóng search bar
      setIsSearchInputVisible(false);
      
      // Nếu menu đang mở và người dùng bấm lại tab hiện tại -> Đóng menu và trở về mặc định
      if (isGenreCountryMenuVisible && activeTab === tab) {
        setIsGenreCountryMenuVisible(false);
        // Không cần quay về mặc định nếu người dùng đang ở bộ lọc hợp lệ (genre, country)
        if (activeFilter.type !== 'genre' && activeFilter.type !== 'country') {
             handleFilterSelect(DEFAULT_FILTER, 'default');
        }
        return;
      }
      
      // Mở menu: Chỉ cập nhật tab và hiển thị menu, không thay đổi activeFilter ngay lập tức
      setActiveTab(tab);
      setIsGenreCountryMenuVisible(true);
      
      // **Loại bỏ việc đặt activeFilter là placeholder và xóa danh sách phim**
      // Danh sách phim hiện tại vẫn được giữ nguyên
      setLoading(false);
  }

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
    // Nếu menu đang mở (placeholder filter cũ đã bị loại bỏ)
    if (isGenreCountryMenuVisible) {
        return activeFilter.name.toUpperCase();
    }
    return 'PHIM MỚI CẬP NHẬT';
  }

  // Cập nhật renderMovieItem để truyền thêm props
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

  // Component Thanh lọc nhanh (FilterBar)
  const FilterBar = () => {
    // Logic xác định nút nào đang được chọn:
    // Nút Lịch sử và Phim Mới dựa vào activeFilter.type.
    // Nút Thể loại/Quốc gia được coi là "active" nếu menu đang mở và tab tương ứng đang chọn, HOẶC nếu nó là activeFilter.type.
    
    const isGenreActive = activeFilter.type === 'genre' || (isGenreCountryMenuVisible && activeTab === 'genre');
    const isCountryActive = activeFilter.type === 'country' || (isGenreCountryMenuVisible && activeTab === 'country');

    return (
        <View style={styles.filterBarContainer}>
            {/* 1. Nút Lịch Sử */}
            <TouchableOpacity 
                style={[styles.filterBarButton, activeFilter.type === 'history' && styles.activeFilterBarButton]}
                onPress={() => handleFilterSelect(HISTORY_FILTER, 'history')}
            >
                <Ionicons name="time-outline" size={16} color={activeFilter.type === 'history' ? '#121212' : '#FFD700'} />
                <Text style={[styles.filterBarText, activeFilter.type === 'history' && styles.activeFilterBarText]}>Lịch Sử</Text>
            </TouchableOpacity>

            {/* 2. Nút Thể Loại (Mở Menu) */}
            <TouchableOpacity 
                style={[styles.filterBarButton, isGenreActive && styles.activeFilterBarButton]}
                onPress={() => handleToggleMenu('genre')}
            >
                <Ionicons name="film-outline" size={16} color={isGenreActive ? '#121212' : '#FFD700'} />
                <Text style={[styles.filterBarText, isGenreActive && styles.activeFilterBarText]} numberOfLines={1}>Thể Loại</Text>
            </TouchableOpacity>

            {/* 3. Nút Quốc Gia (Mở Menu) */}
            <TouchableOpacity 
                style={[styles.filterBarButton, isCountryActive && styles.activeFilterBarButton]}
                onPress={() => handleToggleMenu('country')}
            >
                <Ionicons name="flag-outline" size={16} color={isCountryActive ? '#121212' : '#FFD700'} />
                <Text style={[styles.filterBarText, isCountryActive && styles.activeFilterBarText]} numberOfLines={1}>Quốc Gia</Text>
            </TouchableOpacity>
            
            {/* 4. Nút Phim Mới */}
            <TouchableOpacity 
                style={[styles.filterBarButton, activeFilter.type === 'default' && styles.activeFilterBarButton]}
                onPress={() => handleFilterSelect(DEFAULT_FILTER, 'default')}
            >
                <Ionicons name="refresh-outline" size={16} color={activeFilter.type === 'default' ? '#121212' : '#FFD700'} />
                <Text style={[styles.filterBarText, activeFilter.type === 'default' && styles.activeFilterBarText]}>Phim Mới</Text>
            </TouchableOpacity>
        </View>
    );
  }

  // renderGenreCountryMenu (Menu Lọc Thể loại/Quốc gia)
  const renderGenreCountryMenu = () => {
    if (!isGenreCountryMenuVisible) return null;
    
    const currentList = activeTab === 'genre' ? genres : countries;
    const currentType = activeTab === 'genre' ? 'genre' : 'country';
    const currentActiveSlug = activeFilter.type === currentType ? activeFilter.slug : null;

    const menuWidth = screenWidth * 0.9; 

    return (
      <View style={styles.genreMenuOverlay}>
        <View style={[styles.genreMenuContainer, { width: menuWidth }]}>
          <Text style={styles.menuTitle}>CHỌN {activeTab === 'genre' ? 'THỂ LOẠI' : 'QUỐC GIA'}</Text>
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
            
            {currentList.map((item) => (
              <TouchableOpacity
                key={item.slug}
                style={[
                  styles.genreButton,
                  // Đánh dấu mục đang chọn nếu nó trùng với activeFilter hiện tại
                  (activeFilter.type === currentType && currentActiveSlug === item.slug) && styles.selectedGenreButton,
                ]}
                onPress={() => handleFilterSelect(item, currentType)}
              >
                <Text
                  style={[
                    styles.genreButtonText,
                    (activeFilter.type === currentType && currentActiveSlug === item.slug) && styles.selectedGenreButtonText,
                  ]}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={styles.closeMenuButton}
            onPress={() => setIsGenreCountryMenuVisible(false)}
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

  // ------------------- JSX RENDER CHÍNH -------------------
  if (loading && movies.length === 0 && !isGenreCountryMenuVisible) { // Chỉ hiển thị loading nếu không phải đang mở menu và danh sách rỗng
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      
      {/* 1. Ô TÌM KIẾM ĐƯỢC HIỂN THỊ DƯỚI HEADER */}
      {isSearchInputVisible && (
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Nhập tên phim để tìm kiếm..."
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
      )}

      {/* 2. THANH LỌC NHANH */}
      <FilterBar />

      <View style={styles.headerContainer}>
        <Text style={styles.header}>
          🎬 {getHeaderTitle()} 🍿
        </Text>
      </View>
      
      {movies.length === 0 && !loading && !isGenreCountryMenuVisible ? ( // Không hiển thị "Không tìm thấy" nếu đang mở menu
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>
            {activeFilter.type === 'history' ? 'Bạn chưa xem phim nào.' : (error || `Không tìm thấy kết quả nào.`)}
          </Text>
          <TouchableOpacity onPress={() => handleFilterSelect(DEFAULT_FILTER, 'default')} style={styles.retryButton}>
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
      
      {/* 3. MENU LỌC THỂ LOẠI/QUỐC GIA */}
      {renderGenreCountryMenu()}
    </SafeAreaView>
  );
}

// ------------------- STYLES (GIỮ NGUYÊN) -------------------
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#121212' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
    loadingText: { color: '#FFFFFF', marginTop: 10, fontFamily: 'Roboto-Regular' }, 
    
    // STYLE MỚI CHO THANH TÌM KIẾM ẨN/HIỆN
    searchBar: { 
        flexDirection: 'row', 
        padding: 10, 
        backgroundColor: '#1E1E1E', 
        borderBottomWidth: 1, 
        borderBottomColor: '#333' 
    },
    searchInput: { flex: 1, height: 40, backgroundColor: '#2E2E2E', borderRadius: 8, paddingHorizontal: 15, color: '#FFFFFF', marginRight: 8, fontFamily: 'Roboto-Regular' },
    searchButton: { backgroundColor: '#FFD700', width: 40, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    searchButtonText: { fontSize: 18, fontFamily: 'Roboto-Bold' }, 
    clearButton: { position: 'absolute', right: 58, top: 10, bottom: 10, justifyContent: 'center', paddingHorizontal: 5, zIndex: 10 },
    clearButtonText: { color: '#B0B0B0', fontFamily: 'Roboto-Bold', fontSize: 16 }, 

    // STYLE MỚI CHO THANH LỌC NHANH
    filterBarContainer: { 
        flexDirection: 'row', 
        justifyContent: 'space-around', 
        paddingVertical: 10, 
        backgroundColor: '#1E1E1E', 
        borderBottomWidth: 1, 
        borderBottomColor: '#333',
    },
    filterBarButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 20,
        backgroundColor: '#383838',
    },
    activeFilterBarButton: {
        backgroundColor: '#FFD700',
    },
    filterBarText: {
        color: '#FFD700',
        fontFamily: 'Roboto-Regular',
        fontSize: 12,
        marginLeft: 4,
    },
    activeFilterBarText: {
        color: '#121212',
        fontFamily: 'Roboto-Bold',
    },

    headerContainer: { paddingVertical: 10, paddingHorizontal: 10, backgroundColor: '#1E1E1E', borderBottomWidth: 1, borderBottomColor: '#333' },
    header: { fontSize: 18, fontFamily: 'Roboto-Bold', color: '#00BFFF', textAlign: 'center' }, 
    
    list: { paddingHorizontal: 5, paddingTop: 10 }, 
    movieItem: { flexDirection: 'row', backgroundColor: '#1E1E1E', marginBottom: 10, borderRadius: 8, overflow: 'hidden', elevation: 5, marginHorizontal: 5 }, 
    poster: { width: 100, height: 150 },
    infoContainer: { flex: 1, padding: 10, justifyContent: 'center' },
    title: { fontSize: 16, fontFamily: 'Roboto-Bold', color: '#FFFFFF', marginBottom: 5 },
    episode: { fontSize: 14, color: '#B0B0B0', marginBottom: 3, fontFamily: 'Roboto-Regular' },
    quality: { fontSize: 14, color: '#00FF7F', fontFamily: 'Roboto-Regular' }, 
    row: { justifyContent: 'flex-start', marginBottom: 10 }, 
    gridItem: { flexDirection: 'column', backgroundColor: '#1E1E1E', borderRadius: 8, overflow: 'hidden', elevation: 5, marginHorizontal: 5, marginBottom: 10 },
    gridPoster: { width: '100%', height: 250 }, 
    gridInfoContainer: { padding: 8, justifyContent: 'flex-start', minHeight: 80 },
    footerContainer: { paddingVertical: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    noMoreText: { color: '#B0B0B0', fontSize: 14, fontFamily: 'Roboto-Regular' },
    noDataContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    noDataText: { color: '#FFFFFF', fontSize: 16, textAlign: 'center', marginBottom: 15, fontFamily: 'Roboto-Regular' },
    retryButton: { backgroundColor: '#FFD700', padding: 10, borderRadius: 5 },
    retryButtonText: { color: '#121212', fontFamily: 'Roboto-Bold' },
    
    // Styles cho Menu Lọc (GIỮ NGUYÊN)
    genreMenuOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
    genreMenuContainer: { maxHeight: '80%', backgroundColor: '#1E1E1E', borderRadius: 10, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 10 },
    menuTitle: { fontSize: 20, fontFamily: 'Roboto-Bold', color: '#FFD700', textAlign: 'center', marginBottom: 15, borderBottomWidth: 2, borderBottomColor: '#333', paddingBottom: 10 },
    tabContainer: { flexDirection: 'row', marginBottom: 15, backgroundColor: '#383838', borderRadius: 8, overflow: 'hidden' },
    tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#383838' },
    activeTabButton: { backgroundColor: '#00BFFF', borderColor: '#00BFFF' },
    tabButtonText: { color: '#FFFFFF', fontFamily: 'Roboto-Bold' },
    activeTabButtonText: { color: '#121212', fontFamily: 'Roboto-Bold' },
    genreList: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
    genreButton: { backgroundColor: '#383838', paddingVertical: 10, paddingHorizontal: 15, margin: 6, borderRadius: 20, borderWidth: 1, borderColor: '#555' },
    selectedGenreButton: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
    genreButtonText: { color: '#FFFFFF', fontFamily: 'Roboto-Regular' }, 
    selectedGenreButtonText: { color: '#121212', fontFamily: 'Roboto-Bold' },
    closeMenuButton: { marginTop: 20, backgroundColor: '#555', padding: 12, borderRadius: 8, alignItems: 'center' },
    closeMenuButtonText: { color: '#FFFFFF', fontFamily: 'Roboto-Bold', fontSize: 16 },
    
    // === STYLES CHO NÚT XÓA (GIỮ NGUYÊN) ===
    removeButton: { 
        backgroundColor: '#FF0000', 
        paddingVertical: 5, 
        paddingHorizontal: 10, 
        borderRadius: 5, 
        marginTop: 10, 
        alignSelf: 'flex-start',
    },
    removeButtonText: { 
        color: '#FFFFFF', 
        fontFamily: 'Roboto-Bold', 
        fontSize: 13 
    },
    removeButtonGrid: {
        position: 'absolute',
        top: 5,
        right: 5,
        backgroundColor: 'rgba(255, 0, 0, 0.8)',
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    removeButtonGridText: {
        color: '#FFFFFF',
        fontFamily: 'Roboto-Bold',
        fontSize: 16,
    }
});
