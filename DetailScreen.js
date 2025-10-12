import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions, 
  Image, // Đã thêm Image để hiển thị banner
} from 'react-native';
import { Video } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';

// ------------------- LOGIC RESPONSIVE -------------------

// Tính chiều cao video tỷ lệ 16:9
const getVideoHeight = (screenWidth) => screenWidth * 0.5625;

// Xác định nếu màn hình là ngang
const isLandscape = (screenWidth, screenHeight) => screenWidth > screenHeight;

export default function DetailScreen({ route }) {
  const { slug } = route.params;
  const { width: screenWidth, height: screenHeight } = useWindowDimensions(); 
  const isHorizontal = isLandscape(screenWidth, screenHeight); 
  
  const [movieDetail, setMovieDetail] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedM3u8, setSelectedM3u8] = useState(null);
  
  // 💥 NEW: Lưu trữ vị trí video hiện tại (milliseconds) - dùng useRef để không re-render
  const videoPositionRef = useRef(0); 
  // 💥 NEW: Lưu trạng thái chơi (đang chơi / tạm dừng)
  const isPlayingRef = useRef(false);
  // 💥 NEW: Theo dõi xem người dùng đã chọn tập nào chưa (để quyết định hiển thị poster hay video)
  const [hasSelectedEpisode, setHasSelectedEpisode] = useState(false);

  const videoRef = useRef(null);

  // ------------------- EFFECT: FETCH DATA & CLEANUP -------------------
  
  useEffect(() => {
    fetchMovieDetail();

    // Cleanup: Đảm bảo mở khóa hoàn toàn khi rời màn hình để không ảnh hưởng đến màn hình Home
    return () => {
        const unlockOrientation = async () => {
            try {
                await ScreenOrientation.unlockAsync(); 
            } catch (e) {
                console.warn('Lỗi mở khóa hướng màn hình khi unmount:', e);
            }
        };
        unlockOrientation();
    };
  }, [slug]);

  // ------------------- VIDEO ORIENTATION & PLAYBACK HANDLERS -------------------
  
  const handleFullscreenUpdate = async ({ fullscreenUpdate }) => {
    try {
      if (!videoRef.current) return;

      switch (fullscreenUpdate) {
        case Video.FULLSCREEN_UPDATE_PLAYER_DID_PRESENT:
          // Xoay ngang khi BẬT Fullscreen
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
          break;
        case Video.FULLSCREEN_UPDATE_PLAYER_WILL_DISMISS:
          // Trở về hướng dọc khi TẮT Fullscreen
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
          break;
      }
    } catch (e) {
        console.error("Lỗi khi thay đổi hướng màn hình cho video:", e);
    }
  };

  // 💥 NEW: Xử lý cập nhật trạng thái chơi (Lưu vị trí và trạng thái)
  const handlePlaybackStatusUpdate = useCallback((status) => {
    if (status.isLoaded) {
        // Lưu lại vị trí đang chơi
        videoPositionRef.current = status.positionMillis || 0;
        // Lưu lại trạng thái chơi
        isPlayingRef.current = status.isPlaying || status.isBuffering || false;
    }
  }, []);

  // 💥 NEW: Xử lý khi video đã load thành công (Tua và Chơi tiếp khi xoay màn hình)
  const handleVideoLoad = useCallback(async (status) => {
    if (status.isLoaded) {
        // Tua đến vị trí đã lưu trước khi xoay màn hình (chỉ tua khi vị trí > 0)
        if (videoPositionRef.current > 100) { // Đặt ngưỡng 100ms để bỏ qua các vị trí quá nhỏ
            await videoRef.current.setStatusAsync({ 
                positionMillis: videoPositionRef.current, 
            });
        }
        
        // Nếu trước đó đang chơi, thì chơi tiếp
        if (isPlayingRef.current && hasSelectedEpisode) {
            await videoRef.current.playAsync();
        }
    }
  }, [hasSelectedEpisode]);


  // ------------------- API CALLS & HANDLERS -------------------

  const fetchMovieDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`https://phimapi.com/phim/${slug}`);
      const json = await response.json();

      if (json.status && json.movie && json.episodes) {
        setMovieDetail(json.movie);
        setEpisodes(json.episodes);
        
        // Không tự động chọn tập đầu tiên ở đây nữa,
        // chúng ta sẽ đợi người dùng chọn để hiển thị banner trước.
        setSelectedM3u8(json.episodes[0]?.server_data[0]?.link_m3u8 || null);
        
      } else {
        setError('Không tìm thấy chi tiết phim hoặc tập phim.');
      }
    } catch (e) {
      console.error('Detail Fetch Error:', e);
      setError('Lỗi kết nối hoặc xử lý dữ liệu chi tiết.');
    } finally {
      setLoading(false);
    }
  };

  const handleEpisodeSelect = async (link) => {
    if (link === selectedM3u8) {
      // Trường hợp người dùng click lại tập đang xem, chỉ cần play
      if (videoRef.current) {
        await videoRef.current.playAsync();
      }
      return;
    }
    
    // 💥 NEW: Đặt lại vị trí và trạng thái khi chuyển tập
    videoPositionRef.current = 0;
    isPlayingRef.current = true; // Chuyển tập là **auto-play**

    setSelectedM3u8(link);
    setHasSelectedEpisode(true); // Đánh dấu đã chọn tập

    // Nếu videoRef đã có, load link mới và play ngay lập tức
    if (videoRef.current) {
      try {
        // Tham số thứ 3 là forImmediateUpdates.
        await videoRef.current.loadAsync(
            { uri: link }, 
            { 
                shouldPlay: true, 
                positionMillis: 0 
            }, 
            true
        );
      } catch (error) {
        console.error("Lỗi khi load video mới:", error);
      }
    }
  };
  
  // ------------------- RENDER -------------------

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Đang tải chi tiết phim...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Lỗi: {error}</Text>
        <TouchableOpacity onPress={fetchMovieDetail} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!movieDetail) return null;

  const renderEpisodes = () => (
    <View style={styles.episodeSection}>
      <Text style={styles.sectionHeader}>Danh sách tập</Text>
      {episodes.length > 0 ? (
        episodes.map((server, index) => (
          <View key={index} style={styles.serverContainer}>
            <Text style={styles.serverName}>{server.server_name}</Text>
            <View style={styles.episodesRow}>
              {server.server_data &&
                server.server_data.map((episode) => (
                  <TouchableOpacity
                    key={episode.slug}
                    style={[
                      styles.episodeButton,
                      selectedM3u8 === episode.link_m3u8 &&
                        styles.selectedEpisodeButton,
                    ]}
                    onPress={() => handleEpisodeSelect(episode.link_m3u8)}
                  >
                    <Text
                      style={[
                        styles.episodeButtonText,
                        selectedM3u8 === episode.link_m3u8 &&
                          styles.selectedEpisodeButtonText,
                      ]}
                    >
                      {episode.name}
                    </Text>
                  </TouchableOpacity>
                ))}
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.noEpisodesText}>
          Phim này chưa có tập nào hoặc không có dữ liệu phát.
        </Text>
      )}
    </View>
  );

  // 💥 NEW: Component Video Player được tách riêng để dễ dàng đặt vào 2 layout
  const VideoPlayerComponent = () => (
    <View style={[styles.playerContainer, !isHorizontal && { height: getVideoHeight(screenWidth) }]}>
      {hasSelectedEpisode && selectedM3u8 ? (
        <Video
          // 💥 CHANGED: KHÔNG dùng KEY để tránh reset khi đổi tập/xoay màn hình
          ref={videoRef}
          source={{ uri: selectedM3u8 }}
          style={styles.video}
          useNativeControls
          resizeMode="contain"
          // 💥 CHANGED: Tùy chọn trạng thái ban đầu khi component load/re-load
          initialPlaybackStatus={{ 
              shouldPlay: isPlayingRef.current, // Chơi tiếp nếu trước đó đang chơi
              positionMillis: videoPositionRef.current // Tua về vị trí cũ
          }}
          onFullscreenUpdate={handleFullscreenUpdate} 
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate} // Ghi lại vị trí và trạng thái chơi
          onLoad={handleVideoLoad} // Xử lý tua lại khi component được load lại (ví dụ: khi xoay)
        />
      ) : (
        // 💥 NEW: Hiển thị Banner/Poster khi chưa chọn tập
        <View style={[styles.noVideo, !isHorizontal && { height: getVideoHeight(screenWidth) }]}>
          {movieDetail?.thumb_url ? (
            <Image 
                source={{ uri: movieDetail.thumb_url }} 
                style={styles.bannerImage}
                resizeMode="cover"
            />
          ) : (
            <Text style={styles.noVideoText}>Vui lòng chọn tập phim để xem.</Text>
          )}
          
          <Text style={styles.initialSelectText}>Chọn tập phim để xem</Text>
        </View>
      )}
    </View>
  );


  // Layout cho màn hình ngang (Tablet/Horizontal)
  if (isHorizontal) {
    return (
      <View style={stylesHorizontal.horizontalContainer}>
        {/* Video Player chiếm nửa màn hình bên trái */}
        <View style={stylesHorizontal.playerContainer}>
            <VideoPlayerComponent />
        </View>

        {/* Thông tin và danh sách tập cuộn dọc bên phải */}
        <ScrollView style={stylesHorizontal.infoAndEpisodeArea}>
          <View style={styles.infoSection}>
            <Text style={styles.detailTitle}>{movieDetail.name}</Text>
            <Text style={styles.metaText}>
              Trạng thái: {movieDetail.episode_current} | Năm: {movieDetail.year}
            </Text>
            <Text style={styles.content} numberOfLines={4}>
              {(movieDetail.content || '').replace(/<[^>]+>/g, '')}
            </Text>
          </View>
          {renderEpisodes()}
        </ScrollView>
      </View>
    );
  }

  // Layout cho màn hình dọc (Portrait/Default)
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }}>
      {/* 1. Video Player */}
      <VideoPlayerComponent />

      {/* 2. Thông tin phim */}
      <View style={styles.infoSection}>
        <Text style={styles.detailTitle}>{movieDetail.name}</Text>
        <Text style={styles.originalName}>({movieDetail.origin_name})</Text>
        <Text style={styles.content}>
          {(movieDetail.content || '').replace(/<[^>]+>/g, '')}
        </Text>
        <Text style={styles.metaText}>
          🎬 Trạng thái: {movieDetail.episode_current}
        </Text>
        <Text style={styles.metaText}>
          ⏱️ Thời lượng: {movieDetail.time} | 📅 Năm: {movieDetail.year}
        </Text>
        {movieDetail.category && (
          <Text style={styles.metaText}>
            🧩 Thể loại: {movieDetail.category.map((c) => c.name).join(', ')}
          </Text>
        )}
      </View>

      {/* 3. Danh sách tập */}
      {renderEpisodes()}
    </ScrollView>
  );
}

// ----------------- STYLES -----------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
  loadingText: { color: '#FFFFFF', marginTop: 10 },
  errorText: { color: '#FF5555', fontSize: 16, textAlign: 'center', marginBottom: 10 },
  retryButton: { backgroundColor: '#FFD700', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  retryButtonText: { color: '#121212', fontWeight: 'bold' },
  playerContainer: { width: '100%', backgroundColor: '#000' },
  video: { flex: 1 },
  noVideo: { justifyContent: 'center', alignItems: 'center', width: '100%', position: 'relative' }, 
  // 💥 NEW: Style cho ảnh banner
  bannerImage: { width: '100%', height: '100%', position: 'absolute' }, 
  initialSelectText: { 
    color: '#FFD700', 
    fontSize: 18, 
    fontWeight: 'bold', 
    zIndex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    padding: 10, 
    borderRadius: 8
  },
  noVideoText: { color: '#FFD700', fontSize: 16 }, // Giữ lại nếu không có thumb_url
  infoSection: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
  detailTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF' },
  originalName: { fontSize: 16, color: '#B0B0B0', marginBottom: 10 },
  content: { fontSize: 14, color: '#FFFFFF', lineHeight: 20, marginBottom: 10, fontStyle: 'italic' },
  metaText: { fontSize: 14, color: '#00FF7F', marginBottom: 5 },
  episodeSection: { padding: 15 },
  sectionHeader: { fontSize: 18, fontWeight: 'bold', color: '#FFD700', marginBottom: 10 },
  serverContainer: { marginBottom: 15 },
  serverName: { fontSize: 16, fontWeight: '600', color: '#B0B0B0', marginBottom: 5, borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 5 },
  episodesRow: { flexDirection: 'row', flexWrap: 'wrap' },
  episodeButton: { backgroundColor: '#383838', paddingVertical: 8, paddingHorizontal: 12, marginRight: 8, marginBottom: 8, borderRadius: 4, borderWidth: 1, borderColor: '#555' },
  selectedEpisodeButton: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  episodeButtonText: { color: '#FFFFFF', fontWeight: 'bold' },
  selectedEpisodeButtonText: { color: '#121212' },
  noEpisodesText: { color: '#B0B0B0', fontSize: 14, marginTop: 5 },
});

// Styles cho màn hình ngang (Sử dụng khi isHorizontal là true)
const stylesHorizontal = StyleSheet.create({
    horizontalContainer: { flex: 1, flexDirection: 'row', backgroundColor: '#121212' },
    playerContainer: { width: '50%', height: '100%', backgroundColor: '#000' },
    video: { flex: 1 },
    noVideo: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%', position: 'relative' },
    infoAndEpisodeArea: { width: '50%' },
});
