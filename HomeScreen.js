// HomeScreen.js (Đã thêm chức năng Tìm kiếm và Phân trang)
import React, { useState, useEffect } from 'react';
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
} from 'react-native';

// Hàm tạo URL API
const API_LIST_FILM = (page) =>
  `https://phimapi.com/danh-sach/phim-moi-cap-nhat-v3?page=${page}`;
const API_SEARCH = (keyword, page) =>
  `https://phimapi.com/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&page=${page}`;

export default function HomeScreen({ navigation }) {
  // State chung cho danh sách phim và tìm kiếm
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true); // Loading lần đầu
  const [isLoadMore, setIsLoadMore] = useState(false); // Đang tải thêm
  const [page, setPage] = useState(1); // Trang hiện tại
  const [isLastPage, setIsLastPage] = useState(false); // Đã hết phim
  const [error, setError] = useState(null);

  // State riêng cho tìm kiếm
  const [isSearching, setIsSearching] = useState(false); // Đang ở chế độ tìm kiếm
  const [keyword, setKeyword] = useState(''); // Từ khóa tìm kiếm hiện tại

  useEffect(() => {
    // Luôn tải phim mới khi khởi động ứng dụng
    fetchMoviesList(1, false);
  }, []);

  // Hàm tải danh sách phim mới (hoặc tìm kiếm)
  const fetchMoviesList = async (pageToLoad, isSearchMode, currentKeyword = '') => {
    if (pageToLoad === 1) {
      setLoading(true);
      setMovies([]); 
      setError(null);
      setIsLastPage(false);
    } else {
      setIsLoadMore(true);
    }

    const apiURL = isSearchMode
      ? API_SEARCH(currentKeyword, pageToLoad)
      : API_LIST_FILM(pageToLoad);

    try {
      const response = await fetch(apiURL);
      const json = await response.json();
      
      let newItems = [];
      let totalPages = 1;

      if (isSearchMode) {
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

      if (newItems.length > 0) {
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

  // --- HÀM XỬ LÝ SỰ KIỆN ---
  
  const handleMoviePress = (movie) => {
    navigation.navigate('Detail', { slug: movie.slug, movieName: movie.name });
  };
  
  const handleLoadMore = () => {
    if (!isLoadMore && !isLastPage) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchMoviesList(nextPage, isSearching, keyword);
    }
  };
  
  const handleSearch = () => {
    Keyboard.dismiss(); 
    if (!keyword.trim()) {
      // Nếu từ khóa rỗng, trở về danh sách phim mới
      setIsSearching(false);
      setPage(1);
      fetchMoviesList(1, false);
      return;
    }

    setIsSearching(true);
    setPage(1);
    fetchMoviesList(1, true, keyword.trim());
  };

  const clearSearch = () => {
    setKeyword('');
    setIsSearching(false);
    setPage(1);
    fetchMoviesList(1, false);
    Keyboard.dismiss();
  };

  // --- RENDER FUNCTIONS ---

  const renderMovieItem = ({ item }) => (
    <TouchableOpacity
      style={styles.movieItem}
      onPress={() => handleMoviePress(item)}>
      <Image
        // Xử lý link ảnh tương đối từ API tìm kiếm
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
    return <View style={{height: 30}} />;
  };

  // --- JSX RENDER ---
  
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
      <Text style={styles.header}>🍿 {isSearching ? `KẾT QUẢ TÌM KIẾM: ${keyword}` : 'PHIM MỚI CẬP NHẬT'} 🎬</Text>
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Nhập tên phim cần tìm..."
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
      
      {movies.length === 0 && !loading ? (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>
            {error || `Không tìm thấy kết quả nào cho "${keyword}".`}
          </Text>
          <TouchableOpacity onPress={() => fetchMoviesList(1, false)} style={styles.retryButton}>
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
    </SafeAreaView>
  );
}

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
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    paddingVertical: 15,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    marginBottom: 10,
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
  list: {
    paddingHorizontal: 10,
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
});
