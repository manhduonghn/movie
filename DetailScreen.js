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
} from 'react-native';
import { Video } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';

const getVideoHeight = (screenWidth) => screenWidth * 0.5625;

const VideoPlayer = memo(({ 
    currentM3u8, 
    movieDetail, 
    videoPositionRef, 
    isPlayingRef 
}) => {
    const { width: screenWidth } = useWindowDimensions();
    const videoRef = useRef(null);

    // Lưu vị trí và trạng thái chơi
    const handlePlaybackStatusUpdate = useCallback((status) => {
        if (status.isLoaded) {
            videoPositionRef.current = status.positionMillis || 0;
            // Ghi lại trạng thái isPlaying (đang chơi/buffering)
            isPlayingRef.current = status.isPlaying || status.isBuffering || false;
        }
    }, [videoPositionRef, isPlayingRef]);

    // Xử lý chuyển Fullscreen/Xoay màn hình (Buộc khóa hướng)
    const handleFullscreenUpdate = async ({ fullscreenUpdate }) => {
        try {
            if (!videoRef.current) return;
            switch (fullscreenUpdate) {
                case Video.FULLSCREEN_UPDATE_PLAYER_DID_PRESENT:
                    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
                    break;
                case Video.FULLSCREEN_UPDATE_PLAYER_WILL_DISMISS:
                    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
                    break;
            }
        } catch (e) {
            console.error("Lỗi khi thay đổi hướng màn hình cho video:", e);
        }
    };
    
    // Xử lý khi video load xong (Tua lại và Play/Pause)
    const handleVideoLoad = useCallback(async (status) => {
        if (status.isLoaded && videoRef.current) {
            // Tua lại nếu có vị trí đã lưu và không phải là load tập mới (positionMillis = 0)
            if (videoPositionRef.current > 100 && status.positionMillis === 0) { 
                await videoRef.current.setStatusAsync({ 
                    positionMillis: videoPositionRef.current, 
                });
            }
            
            if (isPlayingRef.current) {
                await videoRef.current.playAsync();
            } else {
                await videoRef.current.pauseAsync(); 
            }
        }
    }, [videoPositionRef, isPlayingRef]);


    return (
        <View style={[
            playerStyles.playerContainer, 
            { height: getVideoHeight(screenWidth), width: '100%' }
        ]}>
            {currentM3u8 ? (
                <Video
                    key={currentM3u8} 
                    ref={videoRef}
                    source={{ uri: currentM3u8 }}
                    style={playerStyles.video}
                    useNativeControls
                    resizeMode="contain"
                    initialPlaybackStatus={{ 
                        shouldPlay: isPlayingRef.current, 
                        positionMillis: videoPositionRef.current
                    }}
                    onFullscreenUpdate={handleFullscreenUpdate}
                    onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
                    onLoad={handleVideoLoad} 
                />
            ) : (
                <View style={[playerStyles.noVideo, { height: getVideoHeight(screenWidth) }]}>
                    {movieDetail?.thumb_url ? (
                        <Image 
                            source={{ uri: movieDetail.thumb_url }} 
                            style={playerStyles.bannerImage}
                            resizeMode="cover"
                        />
                    ) : null}
                    
                    <Text style={playerStyles.initialSelectText}>
                        Vui lòng chọn tập phim để xem.
                    </Text>
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
    initialSelectText: { 
      color: '#FFD700', 
      fontSize: 18, 
      fontWeight: 'bold', 
      zIndex: 1, 
      backgroundColor: 'rgba(0,0,0,0.5)', 
      padding: 10, 
      borderRadius: 8
    },
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
    
    const [currentM3u8, setCurrentM3u8] = useState(null); 
    const [selectedEpisodeName, setSelectedEpisodeName] = useState(null); 
    const [selectedServerIndex, setSelectedServerIndex] = useState(0); 
    
    const videoPositionRef = useRef(0); 
    const isPlayingRef = useRef(false);
    
    useEffect(() => {
        fetchMovieDetail();
        return () => {
            ScreenOrientation.unlockAsync().catch(e => console.warn('Lỗi mở khóa:', e));
        };
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

                const firstServerData = json.episodes[0]?.server_data;
                if (firstServerData && firstServerData.length > 0) {
                    const firstEpisode = firstServerData[0]; 
                    setCurrentM3u8(firstEpisode.link_m3u8); 
                    setSelectedEpisodeName(firstEpisode.name);
                    isPlayingRef.current = false;
                    videoPositionRef.current = 0;
                    setSelectedServerIndex(0);
                } else {
                    setCurrentM3u8(null);
                    setSelectedEpisodeName(null);
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

    const handleEpisodeSelect = async (link, episodeName) => { 
        setSelectedEpisodeName(episodeName); 

        if (link === currentM3u8) {
            return;
        }
        
        videoPositionRef.current = 0;
        isPlayingRef.current = true;

        setCurrentM3u8(link);
    };

    const handleServerSelect = (serverIndex) => {
        setSelectedServerIndex(serverIndex);

        const newServer = episodes[serverIndex];
        if (!newServer || !newServer.server_data) return;

        // Ưu tiên tìm tập đang xem (dùng tên)
        const currentEpisodeName = selectedEpisodeName || (newServer.server_data.length > 0 ? newServer.server_data[0].name : null);
        
        // Tìm tập có tên trùng khớp trong Server mới
        const newEpisode = newServer.server_data.find(
            (ep) => ep.name === currentEpisodeName
        );

        // Chọn tập trùng khớp hoặc tập đầu tiên của Server mới
        const targetEpisode = newEpisode || newServer.server_data[0];

        if (targetEpisode) {
            // Đảm bảo video pause khi chuyển server
            isPlayingRef.current = false; 
            videoPositionRef.current = 0; 
            
            // Cập nhật state
            setCurrentM3u8(targetEpisode.link_m3u8);
            setSelectedEpisodeName(targetEpisode.name);
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

    const renderServerButtons = () => (
        <View style={styles.serverSelectionContainer}>
            {episodes.map((server, index) => (
                <TouchableOpacity
                    key={index}
                    style={[
                        styles.serverButton,
                        index === selectedServerIndex && styles.selectedServerButton,
                    ]}
                    onPress={() => handleServerSelect(index)}
                >
                    <Text 
                        style={[
                            styles.serverButtonText,
                            index === selectedServerIndex && styles.selectedServerButtonText,
                        ]}
                    >
                        {server.server_name}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    const renderEpisodeList = (serverData) => (
        <View style={styles.episodesRow}>
            {serverData &&
                serverData.map((episode) => (
                    <TouchableOpacity
                        key={episode.slug}
                        style={[
                            styles.episodeButton,
                            // Highlight tập nếu trùng tên và trùng link
                            episode.name === selectedEpisodeName && currentM3u8 === episode.link_m3u8 &&
                            styles.selectedEpisodeButton,
                        ]}
                        onPress={() => handleEpisodeSelect(episode.link_m3u8, episode.name)} 
                    >
                        <Text
                            style={[
                                styles.episodeButtonText,
                                episode.name === selectedEpisodeName && currentM3u8 === episode.link_m3u8 &&
                                styles.selectedEpisodeButtonText,
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
                    <Text style={styles.noEpisodesText}>
                        Server này không có dữ liệu tập phim.
                    </Text>
                )}
                
            </View>
        );
    };


    // ------------------- Layout cho màn hình ngang (Horizontal) -------------------
    if (isHorizontal) {
        return (
          <View style={stylesHorizontal.horizontalContainer}>
            {/* Player ở bên trái */}
            <View style={stylesHorizontal.playerContainer}>
                <VideoPlayer 
                    currentM3u8={currentM3u8}
                    movieDetail={movieDetail}
                    videoPositionRef={videoPositionRef}
                    isPlayingRef={isPlayingRef}
                />
            </View>

            {/* Thông tin và Tập ở bên phải */}
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

    // ------------------- Layout cho màn hình dọc (Portrait/Default) -------------------
    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }}>
            {/* 1. Video Player */}
            <VideoPlayer 
                currentM3u8={currentM3u8}
                movieDetail={movieDetail}
                videoPositionRef={videoPositionRef}
                isPlayingRef={isPlayingRef}
            />

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
    infoSection: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
    detailTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF' },
    originalName: { fontSize: 16, color: '#B0B0B0', marginBottom: 10 },
    content: { fontSize: 14, color: '#FFFFFF', lineHeight: 20, marginBottom: 10, fontStyle: 'italic' },
    metaText: { fontSize: 14, color: '#00FF7F', marginBottom: 5 },
    episodeSection: { padding: 15 },
    sectionHeader: { fontSize: 18, fontWeight: 'bold', color: '#FFD700', marginBottom: 10 },
    
    serverSelectionContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15 },
    serverButton: { 
        backgroundColor: '#383838', 
        paddingVertical: 10, 
        paddingHorizontal: 15, 
        marginRight: 10, 
        borderRadius: 6, 
        borderWidth: 1, 
        borderColor: '#555' 
    },
    selectedServerButton: { 
        backgroundColor: '#00FF7F', 
        borderColor: '#00FF7F' 
    },
    serverButtonText: { 
        color: '#FFFFFF', 
        fontWeight: '600' 
    },
    selectedServerButtonText: { 
        color: '#121212', 
        fontWeight: 'bold' 
    },
    
    currentEpisodeListContainer: {
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 8,
        padding: 10
    },
    episodesRow: { flexDirection: 'row', flexWrap: 'wrap' },
    episodeButton: { backgroundColor: '#383838', paddingVertical: 8, paddingHorizontal: 12, marginRight: 8, marginBottom: 8, borderRadius: 4, borderWidth: 1, borderColor: '#555' },
    selectedEpisodeButton: { backgroundColor: '#FFD700', borderColor: '#FFD700' }, 
    episodeButtonText: { color: '#FFFFFF', fontWeight: 'bold' },
    selectedEpisodeButtonText: { color: '#121212' },
    noEpisodesText: { color: '#B0B0B0', fontSize: 14, marginTop: 5 },
});

const stylesHorizontal = StyleSheet.create({
    horizontalContainer: { flex: 1, flexDirection: 'row', backgroundColor: '#121212' },
    playerContainer: { width: '50%', height: '100%', backgroundColor: '#000' },
    infoAndEpisodeArea: { width: '50%' },
});
