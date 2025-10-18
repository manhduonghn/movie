import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, useWindowDimensions, Image, Platform, FlatList,
} from 'react-native';
import { Video, Audio } from 'expo-av';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { Ionicons } from '@expo/vector-icons'; 

import { fetchAndProcessPlaylist, getVideoHeight, CONSTANTS } from './m3u8Processor'; 

const { HISTORY_KEY_PREFIX, SAVE_INTERVAL_MS } = CONSTANTS;

async function savePlaybackProgress(slug, movie, episodeName, currentPositionMillis, durationMillis) {
    if (!slug || !movie || !episodeName || !currentPositionMillis || !durationMillis) return;
    
    const percentageWatched = (currentPositionMillis / durationMillis) * 100;
    
    if (currentPositionMillis < 5000 || percentageWatched > 95) {
        return;
    }

    const historyData = {
        movie: { 
            slug: movie.slug,
            name: movie.name,
            origin_name: movie.origin_name,
            thumb_url: movie.thumb_url,
            year: movie.year,
            quality: movie.quality,
            episode_current: episodeName, 
        },
        episodeName: episodeName, 
        position: currentPositionMillis,
        duration: durationMillis,
        timestamp: Date.now(),
    };

    try {
        await AsyncStorage.setItem(
            `${HISTORY_KEY_PREFIX}${slug}`,
            JSON.stringify(historyData)
        );
    } catch (e) {
        console.error('Lỗi lưu lịch sử:', e);
    }
}

async function loadPlaybackHistory(slug) {
    try {
        const jsonValue = await AsyncStorage.getItem(`${HISTORY_KEY_PREFIX}${slug}`);
        return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (e) {
        console.error('Lỗi tải lịch sử:', e);
        return null;
    }
}

const VideoPlayer = memo(({ 
    currentM3u8, 
    movieDetail, 
    videoPositionRef, 
    isPlayingRef,
    setIsFullscreen,
    goToNextEpisode, 
    selectedEpisodeName, 
}) => {
    const { width: screenWidth, height: screenHeight } = useWindowDimensions(); 
    const videoRef = useRef(null);
    const playerHeight = getVideoHeight(screenWidth, screenHeight); 
    
    const requestAudioFocus = useCallback(async () => {
        if (Platform.OS === 'android') {
            try {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    playsInSilentModeIOS: true,
                    interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_TRANSIENT_EXCLUSIVE, 
                    shouldDuckAndroid: false,
                    interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
                });
            } catch (e) {}
        }
    }, []);

    const abandonAudioFocus = useCallback(async () => {
        if (Platform.OS === 'android') {
            try {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    playsInSilentModeIOS: true,
                    interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_MIX_WITH_OTHERS,
                    shouldDuckAndroid: true, 
                    interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_MIX_WITH_OTHERS,
                });
            } catch (e) {}
        }
    }, []);
    
    const handlePlaybackStatusUpdate = useCallback((status) => {
        if (status.isLoaded) {
            videoPositionRef.current = status.positionMillis || 0;
            isPlayingRef.current = status.isPlaying || status.isBuffering || false;
            
            if (status.didJustFinish) {
                goToNextEpisode();
            }

            if (Platform.OS === 'android') {
                if (status.isPlaying) {
                    requestAudioFocus();
                } else if (!status.isPlaying) {
                    abandonAudioFocus(); 
                }
            } 
        }
    }, [videoPositionRef, isPlayingRef, requestAudioFocus, abandonAudioFocus, goToNextEpisode]); 
    
    const handleFullscreenUpdate = async ({ fullscreenUpdate }) => {
        try {
            if (!videoRef.current) return;
            switch (fullscreenUpdate) {
                case Video.FULLSCREEN_UPDATE_PLAYER_DID_PRESENT:
                    setIsFullscreen(true); 
                    break;
                case Video.FULLSCREEN_UPDATE_PLAYER_WILL_DISMISS:
                    setIsFullscreen(false); 
                    break;
            }
        } catch (e) {}
    };
    
    const handleVideoLoadStart = useCallback(async (status) => {
        if (videoRef.current && videoPositionRef.current > 100) { 
            await videoRef.current.setStatusAsync({ 
                positionMillis: videoPositionRef.current, 
            });
        }
    }, [videoPositionRef]);
    
    const handleVideoLoad = useCallback(async (status) => {
        if (status.isLoaded && videoRef.current) {
            if (isPlayingRef.current) {
                await requestAudioFocus();
                await videoRef.current.playAsync();
            } else {
                await abandonAudioFocus();
                await videoRef.current.pauseAsync(); 
            }
        }
    }, [isPlayingRef, requestAudioFocus, abandonAudioFocus]);

    useEffect(() => {
        let intervalId = null;

        if (movieDetail?.slug && selectedEpisodeName) {
            const saveProgress = async () => {
                if (!videoRef.current || !movieDetail) return;

                try {
                    const status = await videoRef.current.getStatusAsync();
                    if (status.isLoaded && status.isPlaying && status.durationMillis > 0) {
                        savePlaybackProgress(
                            movieDetail.slug, 
                            movieDetail, 
                            selectedEpisodeName, 
                            status.positionMillis, 
                            status.durationMillis
                        );
                    }
                } catch (e) {
                }
            };

            intervalId = setInterval(saveProgress, SAVE_INTERVAL_MS);
        }

        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
            abandonAudioFocus(); 
        };
    }, [movieDetail, abandonAudioFocus, selectedEpisodeName]); 
    
    return (
        <View
            style={[
                playerStyles.playerContainer, 
                { height: playerHeight, width: '100%' } 
            ]}
        >
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
                    }} 
                    onFullscreenUpdate={handleFullscreenUpdate}
                    onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
                    onLoadStart={handleVideoLoadStart} 
                    onLoad={handleVideoLoad} 
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

const EpisodeNavigator = memo(({ selectedEpisodeName, goToPrevEpisode, goToNextEpisode, isFirstEpisode, isLastEpisode }) => {
    
    if (isFirstEpisode && isLastEpisode) {
        return null;
    }
    
    return (
        <View style={navigatorStyles.container}>
            
            {!isFirstEpisode ? ( 
                <TouchableOpacity 
                    style={navigatorStyles.button} 
                    onPress={goToPrevEpisode} 
                >
                    <Ionicons name="play-skip-back-circle" size={32} color="#FFFFFF" />
                    <Text style={navigatorStyles.buttonText}>Tập trước</Text>
                </TouchableOpacity>
            ) : <View style={navigatorStyles.buttonPlaceholder} />} 
            
            <View style={navigatorStyles.episodeInfo}>
                <Text style={navigatorStyles.currentEpisodeText} numberOfLines={1}>
                    {selectedEpisodeName || "Chưa chọn tập"}
                </Text>
            </View>

            {!isLastEpisode ? ( 
                <TouchableOpacity 
                    style={navigatorStyles.button} 
                    onPress={goToNextEpisode}
                >
                    <Text style={navigatorStyles.buttonText}>Tập sau</Text>
                    <Ionicons name="play-skip-forward-circle" size={32} color="#FFFFFF" />
                </TouchableOpacity>
            ) : <View style={navigatorStyles.buttonPlaceholder} />}
        </View>
    );
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
    
    const videoPositionRef = useRef(0); 
    const isPlayingRef = useRef(false);
    
    useEffect(() => {
        fetchMovieDetail();
    }, [slug]);

    const findEpisodeData = (episodesData, episodeName) => {
        for (const server of episodesData) {
            const episode = server.server_data.find(ep => ep.name === episodeName);
            if (episode) {
                return { 
                    serverIndex: episodesData.indexOf(server), 
                    episode 
                };
            }
        }
        return null;
    };

    const fetchMovieDetail = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`https://phimapi.com/phim/${slug}`);
            const json = await response.json();

            if (json.status && json.movie && json.episodes) {
                setMovieDetail(json.movie);
                const fetchedEpisodes = json.episodes;
                setEpisodes(fetchedEpisodes);
                
                const history = await loadPlaybackHistory(slug);
                let targetEpisode = null;
                let targetServerIndex = 0;
                let initialPosition = 0;
                
                if (history && history.episodeName) {
                    const historyData = findEpisodeData(fetchedEpisodes, history.episodeName);
                    
                    const isProgressValid = history.position > 5000 && (history.position / history.duration) < 0.95; 

                    if (historyData && isProgressValid) {
                        targetEpisode = historyData.episode;
                        targetServerIndex = historyData.serverIndex;
                        initialPosition = history.position; 
                        isPlayingRef.current = true;
                    }
                } 
                
                if (!targetEpisode) {
                    const firstServerData = fetchedEpisodes[0]?.server_data;
                    if (firstServerData && firstServerData.length > 0) {
                        targetEpisode = firstServerData[0];
                        targetServerIndex = 0;
                        initialPosition = 0; 
                        isPlayingRef.current = false; 
                    }
                }
                
                if (targetEpisode) {
                    videoPositionRef.current = initialPosition;
                    setSelectedServerIndex(targetServerIndex); 
                    await processAndSetM3u8(targetEpisode.link_m3u8, targetEpisode.name, targetServerIndex);
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

    const handleEpisodeSelect = async (link, episodeName, serverIndex) => { 
        videoPositionRef.current = 0; 
        isPlayingRef.current = true; 
        await processAndSetM3u8(link, episodeName, serverIndex); 
    };

    const handleServerSelect = async (serverIndex) => {
        const newServer = episodes[serverIndex];
        if (!newServer || !newServer.server_data) return;

        const currentEpisodeName = selectedEpisodeName || (newServer.server_data.length > 0 ? newServer.server_data[0].name : null);
        
        const newEpisode = newServer.server_data.find((ep) => ep.name === currentEpisodeName);

        const targetEpisode = newEpisode || newServer.server_data[0];
        
        const isSameEpisode = targetEpisode && targetEpisode.name === selectedEpisodeName;

        if (!isSameEpisode) {
            videoPositionRef.current = 0;
            isPlayingRef.current = true; 
        }

        if (targetEpisode) {
            await processAndSetM3u8(targetEpisode.link_m3u8, targetEpisode.name, serverIndex);
        } else {
             setSelectedServerIndex(serverIndex);
        }
    };
    
    const goToPrevEpisode = useCallback(() => {
        const currentServer = episodes[selectedServerIndex];
        if (!currentServer || !currentServer.server_data || !selectedEpisodeName) return;

        const currentEpisodeIndex = currentServer.server_data.findIndex(ep => ep.name === selectedEpisodeName);
        
        if (currentEpisodeIndex > 0) {
            const prevEpisode = currentServer.server_data[currentEpisodeIndex - 1];
            handleEpisodeSelect(prevEpisode.link_m3u8, prevEpisode.name, selectedServerIndex);
        }
    }, [episodes, selectedServerIndex, selectedEpisodeName]);

    const goToNextEpisode = useCallback(() => {
        const currentServer = episodes[selectedServerIndex];
        if (!currentServer || !currentServer.server_data || !selectedEpisodeName) return;

        const currentEpisodeIndex = currentServer.server_data.findIndex(ep => ep.name === selectedEpisodeName);
        
        if (currentEpisodeIndex < currentServer.server_data.length - 1) {
            const nextEpisode = currentServer.server_data[currentEpisodeIndex + 1];
            handleEpisodeSelect(nextEpisode.link_m3u8, nextEpisode.name, selectedServerIndex);
        }
    }, [episodes, selectedServerIndex, selectedEpisodeName]);
    
    const currentServerData = episodes[selectedServerIndex]?.server_data;
    const currentEpisodeIndex = currentServerData?.findIndex(ep => ep.name === selectedEpisodeName) ?? -1;
    
    const isFirstEpisode = currentEpisodeIndex === 0;
    const isLastEpisode = currentEpisodeIndex !== -1 && currentEpisodeIndex === currentServerData.length - 1;


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

    const renderEpisodeItem = ({ item: episode }) => {
        const isSelected = episode.name === selectedEpisodeName && (currentServerData?.findIndex(ep => ep.name === episode.name) === currentEpisodeIndex);
        
        return (
            <TouchableOpacity
                key={episode.slug}
                style={[
                    styles.episodeButton,
                    isSelected && styles.selectedEpisodeButton,
                ]}
                onPress={() => handleEpisodeSelect(episode.link_m3u8, episode.name, selectedServerIndex)} 
                disabled={isManifestProcessing}
            >
                <Text
                    style={[
                        styles.episodeButtonText,
                        isSelected && styles.selectedEpisodeButtonText,
                    ]}
                >
                    {episode.name}
                </Text>
            </TouchableOpacity>
        );
    };

    const renderEpisodeList = (serverData) => (
        <FlatList
            data={serverData}
            renderItem={renderEpisodeItem}
            keyExtractor={item => item.slug || item.name} 
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.episodesRow}
        />
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
                <Text style={styles.originalName}>({movieDetail.origin_name})</Text> 
                <Text style={styles.content} numberOfLines={isHorizontal ? 4 : undefined}>
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
            {renderEpisodes()}
        </>
    );
    
    const mainContainerStyle = isHorizontal ? stylesHorizontal.horizontalContainer : styles.container;
    
    const scrollContentStyle = isHorizontal 
        ? stylesHorizontal.infoAndEpisodeArea 
        : { paddingBottom: 30 };
    
    return (
        <View style={mainContainerStyle}>
            <View style={isHorizontal ? stylesHorizontal.playerAndNavContainer : undefined}>
                
                <View style={isHorizontal ? stylesHorizontal.videoContentWrapper : {width: '100%'}}>
                    <VideoPlayer 
                        currentM3u8={currentM3u8}
                        movieDetail={movieDetail}
                        videoPositionRef={videoPositionRef}
                        isPlayingRef={isPlayingRef}
                        setIsFullscreen={setIsFullscreen} 
                        goToNextEpisode={goToNextEpisode}
                        selectedEpisodeName={selectedEpisodeName} 
                    />
                    
                    {isManifestProcessing && (
                        <View 
                            style={[
                                styles.manifestLoadingOverlay, 
                                { height: getVideoHeight(screenWidth, screenHeight) } 
                            ]}
                        >
                            <ActivityIndicator size="large" color="#FFD700" />
                            <Text style={styles.manifestLoadingText}>Đang tải và xử lý tập phim...</Text>
                        </View>
                    )}

                    {!isFullscreen && currentM3u8 && (
                        <EpisodeNavigator
                            selectedEpisodeName={selectedEpisodeName}
                            goToPrevEpisode={goToPrevEpisode}
                            goToNextEpisode={goToNextEpisode}
                            isFirstEpisode={isFirstEpisode}
                            isLastEpisode={isLastEpisode}
                        />
                    )}
                </View>
            </View>

            {!isFullscreen && (
                <ScrollView 
                    style={isHorizontal ? stylesHorizontal.infoAndEpisodeScroll : styles.container}
                    contentContainerStyle={scrollContentStyle}
                >
                    <DetailContent />
                </ScrollView>
            )}
            
            <StatusBar 
                style={isFullscreen ? "light" : "light"}
                hidden={isFullscreen}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#121212' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
    loadingText: { color: '#FFFFFF', marginTop: 10, fontFamily: 'Roboto-Regular' },
    errorText: { color: '#FF5555', fontSize: 16, textAlign: 'center', marginBottom: 10, fontFamily: 'Roboto-Regular' },
    retryButton: { backgroundColor: '#FFD700', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
    retryButtonText: { color: '#121212', fontFamily: 'Roboto-Bold' },
    infoSection: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
    detailTitle: { fontSize: 22, fontFamily: 'Roboto-Bold', color: '#FFFFFF' },
    originalName: { fontSize: 16, color: '#B0B0B0', marginBottom: 10, fontFamily: 'Roboto-Regular' },
    content: { 
        fontSize: 14, 
        color: '#FFFFFF', 
        lineHeight: 20, 
        marginBottom: 10, 
        fontFamily: 'Roboto-Regular' 
    },
    metaText: { fontSize: 14, color: '#00FF7F', marginBottom: 5, fontFamily: 'Roboto-Regular' },
    episodeSection: { padding: 15 },
    sectionHeader: { fontSize: 18, fontFamily: 'Roboto-Bold', color: '#FFD700', marginBottom: 10 },
    
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
        fontFamily: 'Roboto-Regular',
        fontWeight: '600'
    },
    selectedServerButtonText: { 
        color: '#121212', 
        fontFamily: 'Roboto-Bold' 
    },
    
    currentEpisodeListContainer: {
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 8,
        padding: 10
    },
    episodesRow: { paddingBottom: 5 }, 
    episodeButton: { backgroundColor: '#383838', paddingVertical: 8, paddingHorizontal: 12, marginRight: 8, marginBottom: 8, borderRadius: 4, borderWidth: 1, borderColor: '#555' },
    selectedEpisodeButton: { backgroundColor: '#FFD700', borderColor: '#FFD700' }, 
    episodeButtonText: { color: '#FFFFFF', fontFamily: 'Roboto-Bold' },
    selectedEpisodeButtonText: { color: '#121212', fontFamily: 'Roboto-Regular' },
    noEpisodesText: { color: '#B0B0B0', fontSize: 14, marginTop: 5, fontFamily: 'Roboto-Regular' },

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
        fontFamily: 'Roboto-Bold'
    }
});

const playerStyles = StyleSheet.create({
    playerContainer: { width: '100%', backgroundColor: '#000' },
    video: { flex: 1 },
    noVideo: { justifyContent: 'center', alignItems: 'center', width: '100%', position: 'relative' }, 
    bannerImage: { width: '100%', height: '100%', position: 'absolute' }, 
    initialSelectText: { 
      color: '#FFD700', 
      fontSize: 18, 
      fontFamily: 'Roboto-Bold', 
      zIndex: 1, 
      backgroundColor: 'rgba(0,0,0,0.5)', 
      padding: 10, 
      borderRadius: 8
    },
});

const stylesHorizontal = StyleSheet.create({
    horizontalContainer: { 
        flex: 1, 
        flexDirection: 'row', 
        backgroundColor: '#121212' 
    },
    playerAndNavContainer: { 
        width: '50%', 
        backgroundColor: '#121212',
        justifyContent: 'center', 
        alignItems: 'center', 
        paddingVertical: 10, 
    },
    videoContentWrapper: {
        width: '100%', 
        maxWidth: 700, 
        alignSelf: 'center', 
        flexGrow: 0, 
    },
    infoAndEpisodeScroll: { 
        width: '50%',
        backgroundColor: '#121212',
    },
    infoAndEpisodeArea: { 
        paddingBottom: 30 
    },
});


const navigatorStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 10,
        backgroundColor: '#1C1C1C', 
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 5,
        width: 120, 
        justifyContent: 'center',
    },
    buttonPlaceholder: {
        width: 120, 
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'Roboto-Bold',
        marginHorizontal: 5,
    },
    episodeInfo: {
        flex: 1,
        alignItems: 'center',
        marginHorizontal: 10,
    },
    currentEpisodeText: {
        color: '#FFD700', 
        fontSize: 18,
        fontFamily: 'Roboto-Bold',
    },
});
