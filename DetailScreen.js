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
  // Thêm StatusBar để kiểm soát thanh trạng thái
  StatusBar,
} from 'react-native';
// Thay thế import Video từ 'expo-av' bằng import Video từ 'expo-video'
import { Video } from 'expo-video';
import * as ScreenOrientation from 'expo-screen-orientation';

// HÀM TÍNH TOÁN CHIỀU CAO (GIỮ NGUYÊN)
const getVideoHeight = (screenWidth, screenHeight) => {
    // Tỉ lệ chuẩn 16:9 (chiều rộng:chiều cao), tương đương 9/16 cho chiều cao/chiều rộng
    const aspectRatio = 9 / 16; 
    
    if (screenWidth > screenHeight) {
        // Cảnh quan (Landscape): Video chiếm 50% chiều rộng màn hình (theo style stylesHorizontal)
        const videoWidthInLandscape = screenWidth / 2;
        // Chiều cao được tính toán dựa trên 16:9 của 50% chiều rộng
        const calculatedHeight = videoWidthInLandscape * aspectRatio;
        // Đảm bảo chiều cao không vượt quá chiều cao màn hình
        return Math.min(calculatedHeight, screenHeight);
    } else {
        // Chân dung (Portrait): Video chiếm 100% chiều rộng màn hình
        return screenWidth * aspectRatio;
    }
};

const VideoPlayer = memo(({ 
    currentM3u8, 
    movieDetail, 
    videoPositionRef, 
    isPlayingRef 
}) => {
    const { width: screenWidth, height: screenHeight } = useWindowDimensions(); 
    // VideoRef vẫn được sử dụng
    const videoRef = useRef(null);
    const playerHeight = getVideoHeight(screenWidth, screenHeight);
    
    // expo-video không có onPlaybackStatusUpdate/onLoad như expo-av.
    // Dùng onReadyForDisplay để lấy vị trí ban đầu (tương tự onLoad)
    // Dùng onPlaybackUpdate để cập nhật vị trí (tương tự onPlaybackStatusUpdate)
    
    // Lưu vị trí và trạng thái chơi khi video đang phát
    const handlePlaybackUpdate = useCallback((status) => {
        // status.currentTime là giây, cần nhân 1000 để thành mili giây
        if (status.isPlaing || status.isBuffering) {
            videoPositionRef.current = status.currentTime * 1000 || 0;
            isPlayingRef.current = status.isPlaying || status.isBuffering || false;
        }
    }, [videoPositionRef, isPlayingRef]);


    // XỬ LÝ FULLSCREEN VÀ STATUS BAR
    // Sử dụng prop 'onFullscreenChange' của expo-video
    const handleFullscreenChange = async (event) => {
        try {
            // event.enterFullscreen là boolean (true khi vào, false khi thoát)
            const isEntering = event.enterFullscreen;
            
            if (isEntering) {
                // Ẩn Status Bar khi vào Fullscreen
                StatusBar.setHidden(true, 'fade');
                await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
            } else {
                // Hiện Status Bar khi thoát Fullscreen
                StatusBar.setHidden(false, 'fade');
                await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
            }
        } catch (e) {
            console.error("Lỗi khi thay đổi hướng màn hình cho video:", e);
        }
    };
    
    // Xử lý khi video load xong và sẵn sàng để hiển thị (tương đương onLoad của expo-av)
    const handleVideoReady = useCallback(() => {
        // Khi video đã sẵn sàng, tua lại vị trí đã lưu và đặt trạng thái phát
        if (videoRef.current) {
            const positionInSeconds = videoPositionRef.current / 1000;
            
            // Tua lại vị trí nếu nó lớn hơn 0
            if (positionInSeconds > 0) {
                videoRef.current.seek(positionInSeconds);
            }

            // Đặt trạng thái phát
            if (isPlayingRef.current) {
                videoRef.current.play();
            } else {
                videoRef.current.pause(); 
            }
        }
    }, [videoPositionRef, isPlayingRef]);


    // Dùng useEffect để set vị trí và trạng thái khi component mount với source mới
    useEffect(() => {
        if (videoRef.current && currentM3u8) {
            const positionInSeconds = videoPositionRef.current / 1000;
            
            // Dùng seekToPosition để đảm bảo tua chính xác khi nguồn thay đổi
            if (positionInSeconds > 0) {
                videoRef.current.seek(positionInSeconds);
            }
            
            // Dùng play/pause để đồng bộ trạng thái
            if (isPlayingRef.current) {
                videoRef.current.play();
            } else {
                videoRef.current.pause();
            }
        }
    }, [currentM3u8, videoPositionRef, isPlayingRef]);


    return (
        <View style={[
            playerStyles.playerContainer, 
            { height: playerHeight, width: '100%' }
        ]}>
            {currentM3u8 ? (
                <Video
                    key={currentM3u8} 
                    ref={videoRef}
                    source={{ uri: currentM3u8 }}
                    style={playerStyles.video}
                    useNativeControls // Giữ nguyên điều khiển gốc
                    resizeMode="contain"
                    // expo-video không dùng initialPlaybackStatus, cần điều khiển bằng ref
                    
                    // Sử dụng onFullscreenChange thay cho onFullscreenUpdate
                    onFullscreenChange={handleFullscreenChange}
                    
                    // Sử dụng onPlaybackUpdate để theo dõi vị trí/trạng thái
                    onPlaybackUpdate={handlePlaybackUpdate}
                    
                    // Sử dụng onReadyForDisplay để tua lại vị trí khi video load
                    onReadyForDisplay={handleVideoReady} 

                    // Tắt tính năng tự động phát của expo-video và để logic điều khiển ở handleVideoReady/useEffect
                    shouldPlay={false} 
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
                    
                    <Text style={playerStyles.initialSelectText}>
                        Vui lòng chọn tập phim để xem.
                    </Text>
                </View>
            )}
        </View>
    );
});

// Giữ nguyên Styles và các logic khác...
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
            // Đảm bảo Status Bar hiện lại khi thoát màn hình chi tiết
            StatusBar.setHidden(false, 'fade');
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

        const currentEpisodeName = selectedEpisodeName || (newServer.server_data.length > 0 ? newServer.server_data[0].name : null);
        
        const newEpisode = newServer.server_data.find(
            (ep) => ep.name === currentEpisodeName
        );

        const targetEpisode = newEpisode || newServer.server_data[0];

        if (targetEpisode) {
            isPlayingRef.current = false; 
            videoPositionRef.current = 0; 
            
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
    
    // Component chứa Thông tin Phim và Danh sách Tập
    const DetailContent = () => (
        <>
            <View style={styles.infoSection}>
                <Text style={styles.detailTitle}>{movieDetail.name}</Text>
                {!isHorizontal && <Text style={styles.originalName}>({movieDetail.origin_name})</Text>}
                <Text style={styles.content} numberOfLines={isHorizontal ? 4 : undefined}>
                {(movieDetail.content || '').replace(/<[^>]+>/g, '')}
                </Text>
                <Text style={styles.metaText}>
                  🎬 Trạng thái: {movieDetail.episode_current}
                </Text>
                {!isHorizontal && ( 
                    <>
                        <Text style={styles.metaText}>
                        ⏱️ Thời lượng: {movieDetail.time} | 📅 Năm: {movieDetail.year}
                        </Text>
                        {movieDetail.category && (
                        <Text style={styles.metaText}>
                            🧩 Thể loại: {movieDetail.category.map((c) => c.name).join(', ')}
                        </Text>
                        )}
                    </>
                )}
            </View>
            {renderEpisodes()}
        </>
    );

    // Container chính thay đổi style dựa trên hướng màn hình (ngang/dọc)
    const mainContainerStyle = isHorizontal ? stylesHorizontal.horizontalContainer : styles.container;
    
    // ScrollView cho phần Info và Episode
    const scrollContentStyle = isHorizontal 
        ? stylesHorizontal.infoAndEpisodeArea 
        : { paddingBottom: 30 };
    
    
    return (
        <View style={mainContainerStyle}>
            {/* 1. Video Player - Luôn ở vị trí này để không bị unmount */}
            <View style={isHorizontal ? stylesHorizontal.playerContainer : undefined}>
                <VideoPlayer 
                    currentM3u8={currentM3u8}
                    movieDetail={movieDetail}
                    videoPositionRef={videoPositionRef}
                    isPlayingRef={isPlayingRef}
                />
            </View>

            {/* 2. Thông tin phim & Danh sách tập - Nằm trong ScrollView */}
            <ScrollView 
                style={isHorizontal ? stylesHorizontal.infoAndEpisodeScroll : styles.container}
                contentContainerStyle={scrollContentStyle}
            >
                <DetailContent />
            </ScrollView>
        </View>
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

// Styles dành riêng cho layout ngang (isHorizontal = true)
const stylesHorizontal = StyleSheet.create({
    horizontalContainer: { 
        flex: 1, 
        flexDirection: 'row', 
        backgroundColor: '#121212' 
    },
    // Component VideoPlayer nằm trong View này, chiếm 50% chiều rộng, 100% chiều cao
    playerContainer: { 
        width: '50%', 
        height: '100%', 
        backgroundColor: '#000',
        // Căn giữa video theo chiều dọc (trên và dưới) và chiều ngang
        justifyContent: 'center', 
        alignItems: 'center',
    },
    // ScrollView cho phần Info và Episode, chiếm 50% còn lại
    infoAndEpisodeScroll: { 
        width: '50%',
        backgroundColor: '#121212' 
    },
    infoAndEpisodeArea: { 
        paddingBottom: 30 
    },
});
