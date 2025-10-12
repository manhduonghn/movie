import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions, 
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
  // Lấy kích thước bằng hook useWindowDimensions
  const { width: screenWidth, height: screenHeight } = useWindowDimensions(); 
  // Biến này sẽ TỰ ĐỘNG CẬP NHẬT khi màn hình xoay
  const isHorizontal = isLandscape(screenWidth, screenHeight); 
  
  const [movieDetail, setMovieDetail] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedM3u8, setSelectedM3u8] = useState(null);

  const videoRef = useRef(null);

  useEffect(() => {
    fetchMovieDetail();

    // **QUAN TRỌNG:** KHÔNG KHÓA HƯỚNG MÀN HÌNH KHI COMPONENT MOUNT NỮA.
    // Điều này cho phép màn hình tự động xoay theo thiết bị (kích hoạt Responsive Layout).

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

  // ------------------- VIDEO ORIENTATION HANDLERS -------------------
  
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

        const firstServerData = json.episodes[0]?.server_data;
        if (firstServerData && firstServerData.length > 0) {
          setSelectedM3u8(firstServerData[0].link_m3u8);
        } else {
          setSelectedM3u8(null);
        }
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

  const handleEpisodeSelect = (link) => {
    setSelectedM3u8(link);
    if (videoRef.current) {
      videoRef.current.pauseAsync();
      videoRef.current.setStatusAsync({ positionMillis: 0 });
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

  // Layout cho màn hình ngang (Tablet/Horizontal) - Kích hoạt khi thiết bị xoay ngang
  if (isHorizontal) {
    return (
      <View style={stylesHorizontal.horizontalContainer}>
        {/* Video Player chiếm nửa màn hình bên trái */}
        <View style={stylesHorizontal.playerContainer}>
          {selectedM3u8 ? (
            <Video
              key={selectedM3u8} // KEY quan trọng để reset component khi đổi tập
              ref={videoRef}
              source={{ uri: selectedM3u8 }}
              style={stylesHorizontal.video}
              useNativeControls
              resizeMode="contain"
              shouldPlay
              onFullscreenUpdate={handleFullscreenUpdate}
            />
          ) : (
            <View style={stylesHorizontal.noVideo}>
              <Text style={styles.noVideoText}>Vui lòng chọn tập phim để xem.</Text>
            </View>
          )}
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
      <View style={[styles.playerContainer, { height: getVideoHeight(screenWidth) }]}>
        {selectedM3u8 ? (
          <Video
            key={selectedM3u8} // KEY quan trọng để reset component khi đổi tập
            ref={videoRef}
            source={{ uri: selectedM3u8 }}
            style={styles.video}
            useNativeControls
            resizeMode="contain"
            shouldPlay
            onFullscreenUpdate={handleFullscreenUpdate} // Xử lý quay ngang
          />
        ) : (
          <View style={[styles.noVideo, {height: getVideoHeight(screenWidth)}]}> 
            <Text style={styles.noVideoText}>Vui lòng chọn tập phim để xem.</Text>
          </View>
        )}
      </View>

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
  noVideo: { justifyContent: 'center', alignItems: 'center' },
  noVideoText: { color: '#FFD700', fontSize: 16 },
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
    noVideo: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    infoAndEpisodeArea: { width: '50%' },
});
