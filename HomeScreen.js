// HomeScreen.js (Đã thêm chức năng Thể loại, Tìm kiếm và Phân trang)
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
  Dimensions,
  ScrollView,
} from 'react-native';

const { width } = Dimensions.get('window');

// ------------------- API ENDPOINTS -------------------
const API_GENRES = 'https://phimapi.com/the-loai';
const API_LIST_FILM = (page) =>
  `https://phimapi.com/danh-sach/phim-moi-cap-nhat-v3?page=${page}`;
const API_SEARCH = (keyword, page) =>
  `https://phimapi.com/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&page=${page}`;
const API_LIST_GENRE = (genreSlug, page) =>
  `https://phimapi.com/v1/api/the-loai/${genreSlug}?page=${page}`;

export default function HomeScreen({ navigation }) {
  // ------------------- STATE -------------------
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLoadMore, setIsLoadMore] = useState(false);
  const [page, setPage] = useState(1);
  const [isLastPage, setIsLastPage] = useState(false);
  const [error, setError] = useState(null);

  // States cho Tìm kiếm
  const [isSearching, setIsSearching] = useState(false);
  const [keyword, setKeyword] = useState('');

  // States cho Thể loại
  const [genres, setGenres] = useState([]);
  const [isGenreMenuVisible, setIsGenreMenuVisible] = useState(false);
  // Slug null tương ứng với danh sách phim mới cập nhật (mặc định)
  const [selectedGenre, setSelectedGenre] = useState({ name: 'PHIM MỚI', slug: null }); 

  // ------------------- EFFECTS -------------------

  useEffect(() => {
    fetchGenres();
    // Tải danh sách phim ban đầu (Phim Mới Cập Nhật)
    fetchMoviesList(1, false, '', null);
  }, []);

  // ------------------- API CALLS & LOGIC -------------------
  
  const fetchGenres = async () => {
    try {
      const response = await fetch(API_GENRES);
      const json = await response.json();
      if (Array.isArray(json)) {
        // Thêm option "Phim Mới" vào đầu danh sách
        setGenres([{ name: 'Phim Mới', slug: null }, ...json]);
      }
    } catch (e) {
      console.error('Fetch Genres Error:', e);
      // Bỏ qua lỗi này vì không ảnh hưởng đến chức năng chính
    }
  };

  const fetchMoviesList = async (pageToLoad, isSearchMode, currentKeyword = '', currentGenreSlug = null) => {
    if (pageToLoad === 1) {
      setLoading(true);
      setMovies([]);
      setError(null);
      setIsLastPage(false);
    } else {
      setIsLoadMore(true);
    }

    let apiURL;
    if (isSearchMode) {
      apiURL = API_SEARCH(currentKeyword, pageToLoad);
    } else if (currentGenreSlug) {
      apiURL = API_LIST_GENRE(currentGenreSlug, pageToLoad);
    } else {
      apiURL = API_LIST_FILM(pageToLoad);
    }

    try {
      const response = await fetch(apiURL);
      const json = await response.json();

      let newItems = [];
      let totalPages = 1;

      // Xử lý response từ 3 loại API khác nhau
      if (isSearchMode || currentGenreSlug) {
        // API Tìm kiếm và API Thể loại trả về { data: { items, params: { pagination } } }
        if (json.data && json.data.items) {
          newItems = json.data.items;
          totalPages = json.data.params.pagination.totalPages;
        }
      } else {
        // API Phim Mới Cập Nhật trả về { items, pagination }
        if (json.items) {
          newItems = json.items;
          totalPages = json.pagination?.totalPages || 100;
        }
      }

      if (pageToLoad === 1) {
        setMovies(newItems);
      } else {
        setMovies((prevMovies) => [...prevMovies, ...newItems]);
      }

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

  const handleMoviePress = (movie) => {
    navigation.navigate('Detail', { slug: movie.slug, movieName: movie.name });
  };

  const handleLoadMore = () => {
    if (!isLoadMore && !isLastPage) {
      const nextPage = page + 1;
      setPage(nextPage);
      // Xác định chế độ hiện tại để tải thêm
      const currentGenreSlug = isSearching ? null : selectedGenre.slug;
      fetchMoviesList(nextPage, isSearching, keyword, currentGenreSlug);
    }
  };

  const handleSearch = () => {
    Keyboard.dismiss();
    // Reset genre khi bắt đầu tìm kiếm
    setSelectedGenre({ name: 'KẾT QUẢ TÌM KIẾM', slug: null }); 

    if (!keyword.trim()) {
      // Nếu từ khóa rỗng, trở về danh sách phim mới
      setIsSearching(false);
      setPage(1);
      fetchMoviesList(1, false, '', null);
      return;
    }

    setIsSearching(true);
    setPage(1);
    fetchMoviesList(1, true, keyword.trim(), null);
  };

  const clearSearch = () => {
    setKeyword('');
    setIsSearching(false);
    // Quay về thể loại hoặc Phim Mới
    setSelectedGenre({ name: 'PHIM MỚI', slug: null });
    setPage(1);
    fetchMoviesList(1, false, '', null);
    Keyboard.dismiss();
  };
  
  const handleGenreSelect = (genre) => {
    // 1. Reset states và thiết lập thể loại mới
    setSelectedGenre(genre);
    setIsSearching(false);
    setKeyword('');
    setPage(1);
    setIsGenreMenuVisible(false); // Đóng menu
    Keyboard.dismiss();

    // 2. Fetch movies cho thể loại đã chọn (hoặc Phim Mới nếu slug là null)
    fetchMoviesList(1, false, '', genre.slug);
  };


  // ------------------- RENDER FUNCTIONS -------------------

  const renderMovieItem = ({ item }) => (
    <TouchableOpacity
      style={styles.movieItem}
      onPress={() => handleMoviePress(item)}>
      <Image
        // Xử lý link ảnh tương đối từ API tìm kiếm/thể loại
        source={{
          uri: item.thumb_url.startsWith('http')
            ? item.thumb_url
            : `https://img.phimapi.com/${item.thumb_url}`
        }}
        style={styles.poster}
        resizeMode="cover"
      />
      <View style={styles.infoContainer}>
        <Text style={styles.title} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.episode}>
          Tập: {item.episode_current || 'N/A'} - Năm: {item.year}
        </Text>
        <Text style={styles.quality}>Chất lượng: {item.quality}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderFooter = () => {
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

  const renderGenreMenu = () => {
    if (!isGenreMenuVisible) return null;

    return (
      <View style={styles.genreMenuOverlay}>
        <View style={styles.genreMenuContainer}>
          <Text style={styles.menuTitle}>CHỌN THỂ LOẠI</Text>
          <ScrollView contentContainerStyle={styles.genreList}>
            {genres.map((genre) => (
              <TouchableOpacity
                key={genre.name}
                style={[
                  styles.genreButton,
                  selectedGenre.slug === genre.slug && styles.selectedGenreButton,
                ]}
                onPress={() => handleGenreSelect(genre)}
              >
                <Text
                  style={[
                    styles.genreButtonText,
                    selectedGenre.slug === genre.slug && styles.selectedGenreButtonText,
                  ]}
                >
                  {genre.name}
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


  // ------------------- JSX RENDER -------------------

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
          🎬 {selectedGenre.name.toUpperCase()} {isSearching && ` CHO "${keyword.toUpperCase()}"`} 🍿
        </Text>
      </View>

      {/* Control Bar: Search and Genre Button */}
      <View style={styles.controlBar}>
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
        
        {/* Genre Toggle Button */}
        <TouchableOpacity 
            onPress={() => setIsGenreMenuVisible(true)} 
            style={styles.genreButtonToggle}
        >
            <Text style={styles.genreButtonToggleText}>THỂ LOẠI</Text>
        </TouchableOpacity>
      </View>
      
      {movies.length === 0 && !loading ? (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>
            {error || `Không tìm thấy kết quả nào.`}
          </Text>
          <TouchableOpacity onPress={() => fetchMoviesList(1, false, '', null)} style={styles.retryButton}>
             <Text style={styles.retryButtonText}>Xem phim mới nhất</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={movies}
          renderItem={renderMovieItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
        />
      )}
      
      {/* Genre Menu Overlay */}
      {renderGenreMenu()}
    </SafeAreaView>
  );
}

// ------------------- STYLES -------------------
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#121212',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 10,
  },
  headerContainer: {
    paddingTop: 15,
    paddingHorizontal: 10,
    backgroundColor: '#1E1E1E',
  },
  header: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    paddingBottom: 10,
  },
  controlBar: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#1E1E1E',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#2E2E2E',
    borderRadius: 8,
    paddingHorizontal: 15,
    color: '#FFFFFF',
    marginRight: 8,
  },
  searchButton: {
    backgroundColor: '#FFD700',
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    fontSize: 18,
  },
  clearButton: {
    position: 'absolute',
    right: 50,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 5,
    zIndex: 10,
  },
  clearButtonText: {
    color: '#B0B0B0',
    fontWeight: 'bold',
    fontSize: 16,
  },
  genreButtonToggle: {
    backgroundColor: '#00BFFF',
    width: 100,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  genreButtonToggleText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  // List Styles remain the same
  list: {
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  movieItem: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    marginBottom: 10,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 5,
  },
  poster: {
    width: 100,
    height: 150,
  },
  infoContainer: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  episode: {
    fontSize: 14,
    color: '#B0B0B0',
    marginBottom: 3,
  },
  quality: {
    fontSize: 14,
    color: '#00FF7F',
    fontWeight: '500',
  },
  footerContainer: {
    paddingVertical: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noMoreText: {
    color: '#B0B0B0',
    fontSize: 14,
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noDataText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 15,
  },
  retryButton: {
    backgroundColor: '#FFD700',
    padding: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#121212',
    fontWeight: 'bold',
  },
  // Genre Menu Styles
  genreMenuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  genreMenuContainer: {
    width: width * 0.9,
    maxHeight: '80%',
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#333',
    paddingBottom: 10,
  },
  genreList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  genreButton: {
    backgroundColor: '#383838',
    paddingVertical: 10,
    paddingHorizontal: 15,
    margin: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#555',
  },
  selectedGenreButton: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  genreButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  selectedGenreButtonText: {
    color: '#121212',
    fontWeight: 'bold',
  },
  closeMenuButton: {
    marginTop: 20,
    backgroundColor: '#555',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeMenuButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
