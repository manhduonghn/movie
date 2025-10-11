import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Video } from 'expo-av';

const { width } = Dimensions.get('window');

export default function DetailScreen({ route }) {
  const { slug } = route.params;
  const [movieDetail, setMovieDetail] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedM3u8, setSelectedM3u8] = useState(null);

  const videoRef = useRef(null);

  useEffect(() => {
    fetchMovieDetail();
  }, [slug]);

  const fetchMovieDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`https://phimapi.com/phim/${slug}`);
      const json = await response.json();

      if (json.status && json.movie && json.episodes) {
        setMovieDetail(json.movie);
        setEpisodes(json.episodes);

        // chọn tập đầu tiên
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
      // Dừng video hiện tại trước khi đổi nguồn
      videoRef.current.stopAsync(); 
    }
  };

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }}>
      {/* 1. Video Player */}
      <View style={styles.playerContainer}>
        {selectedM3u8 ? (
          <Video
            ref={videoRef}
            source={{ uri: selectedM3u8 }}
            style={styles.video}
            useNativeControls
            resizeMode="contain"
            shouldPlay
          />
        ) : (
          <View style={styles.noVideo}>
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
    </ScrollView>
  );
}

// ----------------- STYLES -----------------
const styles = StyleSheet.create({
  container: {
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
  errorText: {
    color: '#FF5555',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#121212',
    fontWeight: 'bold',
  },
  // Player
  playerContainer: {
    width: width,
    height: width * 0.5625,
    backgroundColor: '#000',
  },
  video: {
    flex: 1,
  },
  noVideo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noVideoText: {
    color: '#FFD700',
    fontSize: 16,
  },
  // Info
  infoSection: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  originalName: {
    fontSize: 16,
    color: '#B0B0B0',
    marginBottom: 10,
  },
  content: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
    marginBottom: 10,
    fontStyle: 'italic',
  },
  metaText: {
    fontSize: 14,
    color: '#00FF7F',
    marginBottom: 5,
  },
  // Episodes
  episodeSection: {
    padding: 15,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 10,
  },
  serverContainer: {
    marginBottom: 15,
  },
  serverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#B0B0B0',
    marginBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 5,
  },
  episodesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  episodeButton: {
    backgroundColor: '#383838',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#555',
  },
  selectedEpisodeButton: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  episodeButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  selectedEpisodeButtonText: {
    color: '#121212',
  },
  noEpisodesText: {
    color: '#B0B0B0',
    fontSize: 14,
    marginTop: 5,
  },
});
