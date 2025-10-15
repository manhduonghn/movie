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
// THAY THẾ: import { Video } from 'expo-av';
import { Video, ResizeMode } from 'expo-video'; // 👈 SỬ DỤNG EXPO-VIDEO
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import 'expo-file-system';
import * as FileSystem from 'expo-file-system';

// --- Hàm tiện ích: cleanManifest, fetchAndProcessPlaylist, getVideoHeight (GIỮ NGUYÊN) ---

function cleanManifest(manifest) {
    let cleanedManifest = manifest
        .replace(/\n#EXT-X-DISCONTINUITY\n#EXT-X-KEY:METHOD=NONE[\s\S]*?#EXT-X-DISCONTINUITY\n/g, '\n')
        .replace(/#EXT-X-DISCONTINUITY\n/g, '')
        .replace(/\/convertv7\//g, '/')
        .replace(/\n{2,}/g, '\n')
        .trim();

    return cleanedManifest;
}

async function fetchAndProcessPlaylist(playlistUrl) {
    let req;
    try {
        req = await fetch(playlistUrl);
        if (!req.ok) throw new Error(`Failed to fetch playlist: ${req.statusText}`);
    } catch (error) {
        return playlistUrl; 
    }

    let playlistText = await req.text();

    playlistText = playlistText.replace(/^[^#].*$/gm, (line) => {
        try {
            const parsedUrl = new URL(line, playlistUrl);
            return parsedUrl.toString();
        } catch {
            return line;
        }
    });

    if (playlistText.includes('#EXT-X-STREAM-INF')) {
        const subPlaylistUrl = playlistText.trim().split('\n').filter(line => !line.startsWith('#') && line.trim() !== '').slice(-1)[0];
        if (subPlaylistUrl) {
            return fetchAndProcessPlaylist(subPlaylistUrl);
        }
    }

    const processedPlaylist = cleanManifest(playlistText);
    
    // Lưu manifest vào File System
    const fileUri = `${FileSystem.cacheDirectory}processed_playlist_${Date.now()}.m3u8`;
    
    try {
        await FileSystem.writeAsStringAsync(fileUri, processedPlaylist, {
            encoding: FileSystem.EncodingType.UTF8,
        });
        
        // Trả về URI phù hợp
        if (Platform.OS === 'android') {
            const contentUri = await FileSystem.getContentUriAsync(fileUri);
            return contentUri;
        } else {
            return fileUri;
        }

    } catch (e) {
        console.error("Lỗi khi ghi file manifest cục bộ:", e);
        return playlistUrl; 
    }
}

const getVideoHeight = (screenWidth, screenHeight) => {
    const aspectRatio = 9 / 16; 
    
    if (screenWidth > screenHeight) {
        // Trong chế độ ngang, chiếm 50% chiều rộng (vì container là 50% màn hình)
        const videoWidthInLandscape = screenWidth / 2;
        const calculatedHeight = videoWidthInLandscape * aspectRatio;
        return Math.min(calculatedHeight, screenHeight);
    } else {
        // Trong chế độ dọc, chiều rộng là 100% màn hình
        return screenWidth * aspectRatio;
    }
};

// --- Component VideoPlayer (ĐÃ CẬP NHẬT) ---

const VideoPlayer = memo(({ 
    currentM3u8, 
    movieDetail, 
    videoPositionRef, 
    isPlayingRef,
    setIsFullscreen,
}) => {
    const { width: screenWidth, height: screenHeight } = useWindowDimensions(); 
    // Dùng ref cho component Video
    const videoRef = useRef(null); 
    
    const playerHeight = getVideoHeight(screenWidth, screenHeight);

    // Xử lý cập nhật trạng thái
    // Lưu ý: expo-video không có onPlaybackStatusUpdate tương đương. 
    // Chúng ta sẽ dùng onReadyForDisplay để thiết lập trạng thái ban đầu và
    // sử dụng ref để theo dõi vị trí và trạng thái chơi.
    // LƯU Ý: Việc cập nhật `videoPositionRef` và `isPlayingRef` theo thời gian
    // thực sẽ cần một cơ chế khác (như `onProgress` nếu cần hiển thị UI tùy chỉnh,
    // nhưng với `useNativeControls` thì không cần thiết phải cập nhật liên tục).
    
    // Hàm này sẽ dùng để đặt vị trí video khi nó sẵn sàng phát
    const handleVideoLoad = useCallback(async () => {
        if (videoRef.current) {
             // Lấy trạng thái hiện tại (nếu cần)
             // Lưu ý: expo-video không cung cấp phương thức `getStatusAsync` đơn giản
             // như expo-av. Dữ liệu trạng thái chủ yếu được truyền qua các props
             // và các sự kiện như `onPlaybackStatusUpdate` đã bị loại bỏ/thay đổi.
             
             // Thiết lập lại vị trí (nếu > 100ms)
             if (videoPositionRef.current > 100) {
                 videoRef.current.seek(videoPositionRef.current / 1000); // expo-video dùng giây
             }

             // Tự động play/pause dựa trên ref
             if (isPlayingRef.current) {
                 videoRef.current.play();
             } else {
                 videoRef.current.pause();
             }
        }
    }, [videoPositionRef, isPlayingRef]);

    // Xử lý toàn màn hình - expo-video đơn giản hơn
    const handleFullscreenUpdate = (isEnteringFullscreen) => {
        setIsFullscreen(isEnteringFullscreen);
    };

    // Hàm gọi khi người dùng thoát khỏi toàn màn hình bằng điều khiển gốc
    const onFullscreenPlayerWillDismiss = async () => {
        setIsFullscreen(false);
        // Có thể cần đồng bộ hướng màn hình nếu bạn quản lý thủ công,
        // nhưng với `allowsFullscreen` mặc định, hệ thống sẽ tự xử lý.
        try {
             await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        } catch(e) { /* Bỏ qua lỗi nếu đã khóa */ }
    }
    
    // Hàm gọi khi người dùng vào toàn màn hình bằng điều khiển gốc
    const onFullscreenPlayerDidPresent = async () => {
        setIsFullscreen(true);
        try {
             await ScreenOrientation.unlockAsync(); // Cho phép xoay
        } catch(e) { /* Bỏ qua lỗi nếu đã mở khóa */ }
    }

    // Cập nhật vị trí khi video tạm dừng (người dùng tạm dừng)
    const onPlaybackStateChanged = (status) => {
        if (status.playbackState === 2) { // 2 = Paused
            isPlayingRef.current = false;
        } else if (status.playbackState === 3) { // 3 = Playing
            isPlayingRef.current = true;
        }
        
        // Cập nhật vị trí để lưu tiến trình (Sử dụng onProgress tốt hơn)
    };

    const onProgress = (progress) => {
        // Cập nhật vị trí mili giây cho lần tải lại
        videoPositionRef.current = progress.currentTime * 1000;
    };


    return (
        <View style={[
            playerStyles.playerContainer, 
            { height: playerHeight, width: '100%' }
        ]}>
            {currentM3u8 ? (
                <Video
                    // THAY THẾ: key={currentM3u8} -> Sử dụng source.uri để React tự re-render khi uri thay đổi
                    ref={videoRef}
                    source={{ uri: currentM3u8 }}
                    style={playerStyles.video}
                    // THAY THẾ: useNativeControls
                    useNativeControls
                    // THAY THẾ: resizeMode="contain"
                    resizeMode={ResizeMode.CONTAIN} // Sử dụng Enum từ expo-video
                    // THAY THẾ: initialPlaybackStatus
                    // Dùng props `shouldPlay` và `positionMillis` (giờ là `videoPosition`)
                    // `positionMillis` bị thay thế bằng việc gọi `seek` trong `handleVideoLoad`

                    shouldPlay={isPlayingRef.current} // Đặt trạng thái play ban đầu
                    
                    // Xử lý sự kiện
                    onLoadEnd={handleVideoLoad} // Gọi sau khi video tải xong metadata
                    // onFullscreenUpdate bị thay thế bằng onFullscreenPlayerWillDismiss/DidPresent
                    onFullscreenPlayerWillDismiss={onFullscreenPlayerWillDismiss}
                    onFullscreenPlayerDidPresent={onFullscreenPlayerDidPresent}
                    onPlaybackStateChanged={onPlaybackStateChanged} // Để theo dõi trạng thái Play/Pause
                    onProgress={onProgress} // Để theo dõi và lưu vị trí (tính bằng giây)
                    
                    // Các props khác của expo-video
                    allowsFullscreen={true}
                    // allowsPictureInPicture={true} // (Tùy chọn)
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

// --- Styles (GIỮ NGUYÊN) ---

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

// --- Component DetailScreen (GIỮ NGUYÊN logic) ---

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
    
    const videoPositionRef = useRef(0); // Giữ nguyên, lưu vị trí (millis)
    const isPlayingRef = useRef(false);
    
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

                const firstServerData = json.episodes[0]?.server_data;
                if (firstServerData && firstServerData.length > 0) {
                    await processAndSetM3u8(firstServerData[0].link_m3u8, firstServerData[0].name, 0);
                } else {
                    setCurrentM3u8(null);
                    setSelectedEpisodeName(null);
                }
            } else {
                setError('Không tìm thấy chi tiết phim hoặc tập phim.');
            }
        } catch (e) {
            setError('Lỗi kết nối hoặc xử lý dữ liệu chi tiết.');
        } finally {
            setLoading(false);
        }
    };
    
    const processAndSetM3u8 = async (link_m3u8, episodeName, serverIndex) => {
        if (link_m3u8 === currentM3u8) {
            return;
        }
        
        videoPositionRef.current = 0;
        isPlayingRef.current = true;
        
        setCurrentM3u8(null); 
        setIsManifestProcessing(true);

        try {
            const processedUrl = await fetchAndProcessPlaylist(link_m3u8);
            
            setCurrentM3u8(processedUrl);
            setSelectedEpisodeName(episodeName);
            setSelectedServerIndex(serverIndex);

        } catch (error) {
            setCurrentM3u8(link_m3u8);
            setSelectedEpisodeName(episodeName);
            setSelectedServerIndex(serverIndex);

        } finally {
            setIsManifestProcessing(false);
        }
    };

    const handleEpisodeSelect = async (link, episodeName) => { 
        await processAndSetM3u8(link, episodeName, selectedServerIndex);
    };

    const handleServerSelect = async (serverIndex) => {
        const newServer = episodes[serverIndex];
        if (!newServer || !newServer.server_data) return;

        const currentEpisodeName = selectedEpisodeName || (newServer.server_data.length > 0 ? newServer.server_data[0].name : null);
        
        const newEpisode = newServer.server_data.find(
            (ep) => ep.name === currentEpisodeName
        );

        const targetEpisode = newEpisode || newServer.server_data[0];

        if (targetEpisode) {
            await processAndSetM3u8(targetEpisode.link_m3u8, targetEpisode.name, serverIndex);
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
    if (error) {
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
                    style={[
                        styles.serverButton,
                        index === selectedServerIndex && styles.selectedServerButton,
                    ]}
                    onPress={() => handleServerSelect(index)}
                    disabled={isManifestProcessing}
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
                        disabled={isManifestProcessing}
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

    const mainContainerStyle = isHorizontal ? stylesHorizontal.horizontalContainer : styles.container;
    
    const scrollContentStyle = isHorizontal 
        ? stylesHorizontal.infoAndEpisodeArea 
        : { paddingBottom: 30 };
    
    
    return (
        <View style={mainContainerStyle}>
            <View style={isHorizontal ? stylesHorizontal.playerContainer : undefined}>
                <VideoPlayer 
                    currentM3u8={currentM3u8}
                    movieDetail={movieDetail}
                    videoPositionRef={videoPositionRef}
                    isPlayingRef={isPlayingRef}
                    setIsFullscreen={setIsFullscreen} 
                />
                
                {isManifestProcessing && (
                    <View style={styles.manifestLoadingOverlay}>
                        <ActivityIndicator size="large" color="#FFD700" />
                        <Text style={styles.manifestLoadingText}>Đang tải và xử lý tập phim...</Text>
                    </View>
                )}
            </View>

            <ScrollView 
                style={isHorizontal ? stylesHorizontal.infoAndEpisodeScroll : styles.container}
                contentContainerStyle={scrollContentStyle}
            >
                <DetailContent />
            </ScrollView>
            
            <StatusBar 
                style={isFullscreen ? "light" : "light"}
                hidden={isFullscreen}
            />
        </View>
    );
}

// ----------------- STYLES (GIỮ NGUYÊN) -----------------

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

    manifestLoadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    manifestLoadingText: {
        color: '#FFFFFF',
        marginTop: 10,
        fontSize: 14,
        fontWeight: 'bold'
    }
});

const stylesHorizontal = StyleSheet.create({
    horizontalContainer: { 
        flex: 1, 
        flexDirection: 'row', 
        backgroundColor: '#121212' 
    },
    playerContainer: { 
        width: '50%', 
        height: '100%', 
        backgroundColor: '#000',
        justifyContent: 'center', 
        alignItems: 'center',
    },
    infoAndEpisodeScroll: { 
        width: '50%',
        backgroundColor: '#121212' 
    },
    infoAndEpisodeArea: { 
        paddingBottom: 30 
    },
});
