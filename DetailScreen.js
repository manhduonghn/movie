import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions, 
  Image,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import WebView from 'react-native-webview'; // 🚨 Thư viện cần thiết

// Base URL của player nhúng bên ngoài
const EMBED_PLAYER_URL = "https://luxysiv.github.io/mplayer?url=";

// Hàm tính chiều cao video dựa trên kích thước màn hình
const getVideoHeight = (screenWidth, screenHeight) => {
  const aspectRatio = 9 / 16; 
  if (screenWidth > screenHeight) {
    const videoWidthInLandscape = screenWidth / 2;
    const calculatedHeight = videoWidthInLandscape * aspectRatio;
    return Math.min(calculatedHeight, screenHeight);
  } else {
    return screenWidth * aspectRatio;
  }
};

// 🚨 COMPONENT MỚI: WebView Player
const WebViewPlayer = memo(({ currentM3u8Url, movieDetail }) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions(); 
  const playerHeight = getVideoHeight(screenWidth, screenHeight);
  
  // URL đầy đủ, bao gồm URL M3U8 gốc đã được mã hóa
  const sourceUrl = currentM3u8Url 
    ? EMBED_PLAYER_URL + encodeURIComponent(currentM3u8Url)
    : null;

  return (
    <View style={[playerStyles.playerContainer, { height: playerHeight, width: '100%' }]}>
      {sourceUrl ? (
        <WebView
          key={sourceUrl}
          source={{ uri: sourceUrl }}
          style={playerStyles.video}
          // Các thuộc tính quan trọng cho phát video trong WebView
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsFullscreenVideo={true} // Cho phép sử dụng chế độ toàn màn hình native
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false} // Tự động phát (tùy thuộc vào trình duyệt)
          originWhitelist={['*']} // Cho phép tải các tài nguyên bên ngoài
          onError={(syntheticEvent) => console.error("WebView Error:", syntheticEvent.nativeEvent)}
        />
      ) : (
        <View style={[playerStyles.noVideo, { height: playerHeight }]}>
          {movieDetail?.thumb_url ? (
            <Image 
              source={{ uri: movieDetail.thumb_url }} 
              style={playerStyles.bannerImage}
              resizeMode="cover"
            />
          ) : null}
          <Text style={playerStyles.initialSelectText}>Vui lòng chọn tập phim để xem.</Text>
        </View>
      )}
    </View>
  );
});

const playerStyles = StyleSheet.create({
  playerContainer: { width: '100%', backgroundColor: '#000' },
  video: { flex: 1 },
  noVideo: { justifyContent: 'center', alignItems: 'center', width: '100%', position: 'relative' }, 
  bannerImage: { width: '100%', height: '100%', position: 'absolute' }, 
  initialSelectText: { color: '#FFD700', fontSize: 18, fontWeight: 'bold', zIndex: 1, backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 8 },
});

const isLandscape = (screenWidth, screenHeight) => screenWidth > screenHeight;

export default function DetailScreen({ route }) {
  const { slug } = route.params;
  const { width: screenWidth, height: screenHeight } = useWindowDimensions(); 
  const isHorizontal = isLandscape(screenWidth, screenHeight); 
  const [movieDetail, setMovieDetail] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isManifestProcessing, setIsManifestProcessing] = useState(false); 
  const [currentM3u8, setCurrentM3u8] = useState(null); 
  const [selectedEpisodeName, setSelectedEpisodeName] = useState(null); 
  const [selectedServerIndex, setSelectedServerIndex] = useState(0); 
  const [isFullscreen, setIsFullscreen] = useState(false); 
  // Loại bỏ các refs liên quan đến Expo AV
  
  useEffect(() => {
    fetchMovieDetail();
  }, [slug]);
  
  const updateM3u8Link = (link_m3u8, episodeName, serverIndex) => {  
    if (link_m3u8 === currentM3u8) return;
    
    setCurrentM3u8(null); 
    setError(null);
    setIsManifestProcessing(true);

    try {
      // Chỉ cần lưu link M3U8 gốc
      setCurrentM3u8(link_m3u8); 
      setSelectedEpisodeName(episodeName);
      setSelectedServerIndex(serverIndex);
      
    } catch (e) {
      console.error("Lỗi khi set link M3U8:", e.message);
      setError("Không thể tạo link phát. Vui lòng thử server khác.");
      setCurrentM3u8(null);
    } finally {
      setIsManifestProcessing(false);
    }
  };

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
          updateM3u8Link(firstServerData[0].link_m3u8, firstServerData[0].name, 0);
        } else {
          setCurrentM3u8(null);
          setSelectedEpisodeName(null);
        }
      } else {
        setError('Không tìm thấy chi tiết phim hoặc tập phim.');
      }
    } catch {
      setError('Lỗi kết nối hoặc xử lý dữ liệu chi tiết.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleEpisodeSelect = async (link, episodeName) => { 
    updateM3u8Link(link, episodeName, selectedServerIndex);
  };
  
  const handleServerSelect = async (serverIndex) => {
    const newServer = episodes[serverIndex];
    if (!newServer || !newServer.server_data) return;
    const currentEpisodeName = selectedEpisodeName || (newServer.server_data.length > 0 ? newServer.server_data[0].name : null);
    const newEpisode = newServer.server_data.find((ep) => ep.name === currentEpisodeName);
    const targetEpisode = newEpisode || newServer.server_data[0];
    if (targetEpisode) {
      updateM3u8Link(targetEpisode.link_m3u8, targetEpisode.name, serverIndex);
    } else {
      setSelectedServerIndex(serverIndex);
    }
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Đang tải chi tiết phim...</Text>
        <StatusBar style="light" />
      </View>
    );
  }
  
  if (error && !currentM3u8) { 
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Lỗi: {error}</Text>
        <TouchableOpacity onPress={fetchMovieDetail} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Thử lại</Text>
        </TouchableOpacity>
        <StatusBar style="light" />
      </View>
    );
  }
  
  if (!movieDetail) return null;
  
  const renderServerButtons = () => (
    <View style={styles.serverSelectionContainer}>
      {episodes.map((server, index) => (
        <TouchableOpacity
          key={index}
          style={[styles.serverButton, index === selectedServerIndex && styles.selectedServerButton]}
          onPress={() => handleServerSelect(index)}
          disabled={isManifestProcessing}
        >
          <Text style={[styles.serverButtonText, index === selectedServerIndex && styles.selectedServerButtonText]}>
            {server.server_name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
  
  const renderEpisodeList = (serverData) => (
    <View style={styles.episodesRow}>
      {serverData && serverData.map((episode) => (
        <TouchableOpacity
          key={episode.slug}
          style={[
            styles.episodeButton,
            episode.name === selectedEpisodeName && styles.selectedEpisodeButton,
          ]}
          onPress={() => handleEpisodeSelect(episode.link_m3u8, episode.name)} 
          disabled={isManifestProcessing}
        >
          <Text
            style={[
              styles.episodeButtonText,
              episode.name === selectedEpisodeName && styles.selectedEpisodeButtonText,
            ]}
          >
            {episode.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
  
  const renderEpisodes = () => {
    const currentServer = episodes[selectedServerIndex];
    return (
      <View style={styles.episodeSection}>
        <Text style={styles.sectionHeader}>Danh sách tập</Text>
        {renderServerButtons()}
        {currentServer && currentServer.server_data ? (
          <View style={styles.currentEpisodeListContainer}>
            {renderEpisodeList(currentServer.server_data)}
          </View>
        ) : (
          <Text style={styles.noEpisodesText}>Server này không có dữ liệu tập phim.</Text>
        )}
      </View>
    );
  };
  
  const DetailContent = () => (
    <>
      <View style={styles.infoSection}>
        <Text style={styles.detailTitle}>{movieDetail.name}</Text>
        {!isHorizontal && <Text style={styles.originalName}>({movieDetail.origin_name})</Text>}
        <Text style={styles.content} numberOfLines={isHorizontal ? 4 : undefined}>
          {(movieDetail.content || '').replace(/<[^>]+>/g, '')}
        </Text>
        <Text style={styles.metaText}>🎬 Trạng thái: {movieDetail.episode_current}</Text>
        {!isHorizontal && ( 
          <>
            <Text style={styles.metaText}>⏱️ Thời lượng: {movieDetail.time} | 📅 Năm: {movieDetail.year}</Text>
            {movieDetail.category && (
              <Text style={styles.metaText}>🧩 Thể loại: {movieDetail.category.map((c) => c.name).join(', ')}</Text>
            )}
          </>
        )}
      </View>
      {renderEpisodes()}
    </>
  );
  
  const mainContainerStyle = isHorizontal ? stylesHorizontal.horizontalContainer : styles.container;
  const scrollContentStyle = isHorizontal ? stylesHorizontal.infoAndEpisodeArea : { paddingBottom: 30 };
  
  return (
    <View style={mainContainerStyle}>
      <View style={isHorizontal ? stylesHorizontal.playerContainer : undefined}>
        <WebViewPlayer 
          currentM3u8Url={currentM3u8}
          movieDetail={movieDetail}
          setIsFullscreen={setIsFullscreen} 
        />
        {isManifestProcessing && (
          <View style={styles.manifestLoadingOverlay}>
            <ActivityIndicator size="large" color="#FFD700" />
            <Text style={styles.manifestLoadingText}>Đang tải tập phim...</Text>
          </View>
        )}
      </View>
      <ScrollView 
        style={isHorizontal ? stylesHorizontal.infoAndEpisodeScroll : styles.container}
        contentContainerStyle={scrollContentStyle}
      >
        <DetailContent />
      </ScrollView>
      <StatusBar style="light" hidden={isFullscreen} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
  loadingText: { color: '#FFFFFF', marginTop: 10 },
  errorText: { color: '#FF5555', fontSize: 16, textAlign: 'center', marginBottom: 10 },
  retryButton: { backgroundColor: '#FFD700', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  retryButtonText: { color: '#121212', fontWeight: 'bold' },
  infoSection: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
  detailTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF' },
  originalName: { fontSize: 16, color: '#B0B0B0', marginBottom: 10 },
  content: { fontSize: 14, color: '#FFFFFF', lineHeight: 20, marginBottom: 10, fontStyle: 'italic' },
  metaText: { fontSize: 14, color: '#00FF7F', marginBottom: 5 },
  episodeSection: { padding: 15 },
  sectionHeader: { fontSize: 18, fontWeight: 'bold', color: '#FFD700', marginBottom: 10 },
  serverSelectionContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15 },
  serverButton: { backgroundColor: '#383838', paddingVertical: 10, paddingHorizontal: 15, marginRight: 10, borderRadius: 6, borderWidth: 1, borderColor: '#555' },
  selectedServerButton: { backgroundColor: '#00FF7F', borderColor: '#00FF7F' },
  serverButtonText: { color: '#FFFFFF', fontWeight: '600' },
  selectedServerButtonText: { color: '#121212', fontWeight: 'bold' },
  currentEpisodeListContainer: { borderWidth: 1, borderColor: '#333', borderRadius: 8, padding: 10 },
  episodesRow: { flexDirection: 'row', flexWrap: 'wrap' },
  episodeButton: { backgroundColor: '#383838', paddingVertical: 8, paddingHorizontal: 12, marginRight: 8, marginBottom: 8, borderRadius: 4, borderWidth: 1, borderColor: '#555' },
  selectedEpisodeButton: { backgroundColor: '#FFD700', borderColor: '#FFD700' }, 
  episodeButtonText: { color: '#FFFFFF', fontWeight: 'bold' },
  selectedEpisodeButtonText: { color: '#121212' },
  noEpisodesText: { color: '#B0B0B0', fontSize: 14, marginTop: 5 },
  manifestLoadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  manifestLoadingText: { color: '#FFFFFF', marginTop: 10, fontSize: 14, fontWeight: 'bold' }
});

const stylesHorizontal = StyleSheet.create({
  horizontalContainer: { flex: 1, flexDirection: 'row', backgroundColor: '#121212' },
  playerContainer: { width: '50%', height: '100%', backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  infoAndEpisodeScroll: { width: '50%', backgroundColor: '#121212' },
  infoAndEpisodeArea: { paddingBottom: 30 }
});
