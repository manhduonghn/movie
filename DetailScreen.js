import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, useWindowDimensions, Image, Platform, FlatList, TextInput, Keyboard,
} from 'react-native';
import { Audio } from 'expo-audio';
import {
    VideoView,
    useVideoPlayer,
} from 'expo-video';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useEvent } from 'expo';

import { fetchAndProcessPlaylist, getVideoHeight, CONSTANTS } from './m3u8Processor';

const { HISTORY_KEY_PREFIX, SAVE_INTERVAL_MS } = CONSTANTS;

// ---------------------------------------------------
// 1. CẬP NHẬT: Thêm poster_url vào dữ liệu History
// ---------------------------------------------------
async function savePlaybackProgress(slug, movie, episodeName, serverIndex, serverName, currentPositionMillis, durationMillis) {

    if (!slug || !movie || !episodeName || !currentPositionMillis || !durationMillis || serverIndex === undefined || serverName === null || durationMillis <= 0) {
        return;
    }

    const percentageWatched = (currentPositionMillis / durationMillis) * 100;

    if (currentPositionMillis < 5000) {
        return;
    }
    if (percentageWatched > 95) {
        return;
    }

    const historyData = {
        movie: {
            slug: movie.slug,
            name: movie.name,
            origin_name: movie.origin_name,
            thumb_url: movie.thumb_url,
            // ➡️ ĐÃ THÊM: poster_url
            poster_url: movie.poster_url, 
            year: movie.year,
            quality: movie.quality,
            episode_current: episodeName,
        },
        episodeName: episodeName,
        serverIndex: serverIndex,
        serverName: serverName,
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
    }
}

async function loadPlaybackHistory(slug) {
    try {
        const jsonValue = await AsyncStorage.getItem(`${HISTORY_KEY_PREFIX}${slug}`);
        return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (e) {
        return null;
    }
}

// ---------------------------------------------------
// 3. CẬP NHẬT: VideoPlayer sử dụng poster_url
// ---------------------------------------------------
const VideoPlayer = memo((props) => {
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const playerHeight = getVideoHeight(screenWidth, screenHeight);

    const player = useVideoPlayer(props.currentM3u8 ? props.currentM3u8 : null);

    const videoDurationRef = useRef(0);
    const lastSaveTimeRef = useRef(Date.now());
    const THROTTLE_MS = SAVE_INTERVAL_MS || 5000;

    const requestAudioFocus = useCallback(async () => {
        if (Platform.OS === 'android') {
            try {
                await Audio.setModeAsync({
                    allowsRecordingIOS: false,
                    playsInSilentModeIOS: true,
                    interruptionModeAndroid: Audio.InterruptionModeAndroid.DoNotMix,
                    shouldDuckAndroid: false,
                    interruptionModeIOS: Audio.InterruptionModeIOS.MixWithOthers,
                    staysActiveInBackground: true,
                });
            } catch (e) {}
        }
    }, []);

    const abandonAudioFocus = useCallback(async () => {
        if (Platform.OS === 'android') {
            try {
                await Audio.setModeAsync({
                    allowsRecordingIOS: false,
                    playsInSilentModeIOS: true,
                    interruptionModeAndroid: Audio.InterruptionModeAndroid.MixWithOthers,
                    shouldDuckAndroid: true,
                    interruptionModeIOS: Audio.InterruptionModeIOS.MixWithOthers,
                    staysActiveInBackground: false,
                });
            } catch (e) {}
        }
    }, []);

    const saveProgressThrottled = useCallback(async (currentTime) => {
        const duration = videoDurationRef.current;

        const { movieDetail, selectedEpisodeName, selectedServerIndex, selectedServerName } = props;

        if (!movieDetail?.slug || duration <= 0) {
            return;
        }

        const now = Date.now();
        const timeSinceLastSave = now - lastSaveTimeRef.current;

        if (timeSinceLastSave < THROTTLE_MS) {
            return;
        }

        lastSaveTimeRef.current = now;

        await savePlaybackProgress(
            movieDetail.slug,
            movieDetail,
            selectedEpisodeName,
            selectedServerIndex,
            selectedServerName,
            currentTime * 1000,
            duration * 1000
        );
    }, [
        props.movieDetail,
        props.selectedEpisodeName,
        props.selectedServerIndex,
        props.selectedServerName,
        THROTTLE_MS
    ]);

    useEffect(() => {
        if (!player) return;

        lastSaveTimeRef.current = Date.now();
        videoDurationRef.current = 0;

        const playingSubscription = player.addListener('playingChange', ({ isPlaying }) => {

            if (isPlaying) {
                requestAudioFocus();
            } else {
                abandonAudioFocus();
            }

            props.isPlayingRef.current = isPlaying;
        });

        const durationSubscription = player.addListener('durationChange', ({ duration }) => {
            if (duration > 0 && videoDurationRef.current === 0) {
                videoDurationRef.current = duration;
            }
        });

        const endSubscription = player.addListener('end', () => {
             props.goToNextEpisode();
        });

        const fsSubscription = player.addListener('fullscreenChange', (event) => {
             props.setIsFullscreen(event.isFullscreen);
        });

        return () => {
            playingSubscription.remove();
            durationSubscription.remove();
            endSubscription.remove();
            fsSubscription.remove();
            abandonAudioFocus();
        };
    }, [
        player,
        props.goToNextEpisode,
        props.setIsFullscreen,
        requestAudioFocus,
        abandonAudioFocus,
        props.isPlayingRef,
    ]);

    useEffect(() => {
        if (!player) return;

        const intervalId = setInterval(() => {
            const currentTime = player.currentTime;
            const duration = player.duration;

            if (duration > 0 && videoDurationRef.current === 0) {
                videoDurationRef.current = duration;
            }

            if (player.playing && videoDurationRef.current > 0 && currentTime > 0) {
                saveProgressThrottled(currentTime);
            }

            props.videoPositionRef.current = currentTime * 1000;

        }, THROTTLE_MS);

        return () => {
            clearInterval(intervalId);

            const finalPositionMillis = props.videoPositionRef.current;
            const finalDurationMillis = videoDurationRef.current * 1000;

            if (finalPositionMillis > 0 && finalDurationMillis > 0) {
                savePlaybackProgress(
                    props.movieDetail.slug,
                    props.movieDetail,
                    props.selectedEpisodeName,
                    props.selectedServerIndex,
                    props.selectedServerName,
                    finalPositionMillis,
                    finalDurationMillis
                );
            }
        };
    }, [
        player,
        saveProgressThrottled,
        THROTTLE_MS,
        props.videoPositionRef,
        props.movieDetail,
        props.selectedEpisodeName,
        props.selectedServerIndex,
        props.selectedServerName
    ]);

    useEffect(() => {
        const loadAndSeek = () => {
            if (player && props.currentM3u8) {
                if (props.videoPositionRef.current > 100) {
                    player.currentTime = props.videoPositionRef.current / 1000;
                }

                if (props.isPlayingRef.current) {
                    player.play();
                } else {
                    player.pause();
                }
            }
        };

        const timeout = setTimeout(() => {
            if (player) {
                loadAndSeek();
            }
        }, 500);

        return () => clearTimeout(timeout);

    }, [player, props.currentM3u8, props.videoPositionRef, props.isPlayingRef]);

    // Lấy URL Poster
    const posterUrl = props.movieDetail?.poster_url || props.movieDetail?.thumb_url;

    return (
        <View
            style={[
                playerStyles.playerContainer,
                { height: playerHeight, width: '100%' }
            ]}
        >
            {props.currentM3u8 ? (
               <VideoView
                 style={playerStyles.video}
                 player={player}
                 fullscreenOptions={{
                   allowsPictureInPicture: true,
                   presentationStyle: 'overFullScreen',
                 }}
               />
            ) : (
                <View style={[playerStyles.noVideo, { height: playerHeight }]}>
                    {posterUrl ? (
                        <Image
                            // ➡️ ĐÃ THAY ĐỔI: Sử dụng posterUrl thay vì props.movieDetail.thumb_url
                            source={{ uri: posterUrl }} 
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

const EpisodeNavigator = memo((props) => {
    if (props.isFirstEpisode && props.isLastEpisode) {
        return null;
    }

    return (
        <View style={navigatorStyles.container}>

            {!props.isFirstEpisode ? (
                <TouchableOpacity
                    style={navigatorStyles.button}
                    onPress={props.goToPrevEpisode}
                >
                    <Ionicons name="play-skip-back-circle" size={32} color="#FFFFFF" />
                    <Text style={navigatorStyles.buttonText}>Tập trước</Text>
                </TouchableOpacity>
            ) : <View style={navigatorStyles.buttonPlaceholder} />}

            <View style={navigatorStyles.episodeInfo}>
                <Text style={navigatorStyles.currentEpisodeText} numberOfLines={1}>
                    {props.selectedEpisodeName || "Chưa chọn tập"}
                </Text>
            </View>

            {!props.isLastEpisode ? (
                <TouchableOpacity
                    style={navigatorStyles.button}
                    onPress={props.goToNextEpisode}
                >
                    <Text style={navigatorStyles.buttonText}>Tập sau</Text>
                    <Ionicons name="play-skip-forward-circle" size={32} color="#FFFFFF" />
                </TouchableOpacity>
            ) : <View style={navigatorStyles.buttonPlaceholder} />}
        </View>
    );
});

const isLandscape = (screenWidth, screenHeight) => screenWidth > screenHeight;

const EpisodeSearchControls = memo(({
    sortOrder,
    handleSortToggle,
    setSearchQuery,
    styles
}) => {
    const [searchText, setSearchText] = useState('');

    const handleSearchPress = useCallback(() => {
        setSearchQuery(searchText);
        Keyboard.dismiss();
    }, [searchText, setSearchQuery]);

    const handleClearSearch = useCallback(() => {
        setSearchText('');
        setSearchQuery('');
        Keyboard.dismiss();
    }, [setSearchQuery]);

    const handleTextChange = useCallback((text) => {
        setSearchText(text);
    }, []);

    return (
        <View style={styles.episodeControls}>
            <TouchableOpacity
                style={styles.sortButton}
                onPress={handleSortToggle}
            >
                <Ionicons
                    name={sortOrder === 'desc' ? "arrow-down-circle-sharp" : "arrow-up-circle-sharp"}
                    size={20}
                    color="#FFD700"
                />
                <Text style={styles.sortButtonText}>
                    {sortOrder === 'desc' ? "Cũ nhất" : "Mới nhất"}
                </Text>
            </TouchableOpacity>

            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Tập cần tìm..."
                    placeholderTextColor="#888"
                    value={searchText}
                    onChangeText={handleTextChange}
                    returnKeyType="search"
                    onSubmitEditing={handleSearchPress}
                />

                {/* Clear button */}
                {searchText.length > 0 && (
                    <TouchableOpacity
                        style={styles.clearSearchButton}
                        onPress={handleClearSearch}
                    >
                        <Ionicons name="close-circle-sharp" size={20} color="#B0B0B0" />
                    </TouchableOpacity>
                )}

                {/* Search button */}
                <TouchableOpacity
                    style={styles.searchButton}
                    onPress={handleSearchPress}
                >
                    <Ionicons name="search" size={20} color="#121212" />
                </TouchableOpacity>
            </View>
        </View>
    );
});

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
    const [selectedServerName, setSelectedServerName] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const [sortOrder, setSortOrder] = useState('desc');
    const [searchQuery, setSearchQuery] = useState('');

    const videoPositionRef = useRef(0);
    const isPlayingRef = useRef(false);

    useEffect(() => {
        fetchMovieDetail();
    }, [slug]);

    // ---------------------------------------------------
    // 2. CẬP NHẬT: Xử lý poster_url khi fetch detail
    // ---------------------------------------------------
    const fetchMovieDetail = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`https://phimapi.com/phim/${slug}`);
            const json = await response.json();

            if (json.status && json.movie && json.episodes) {
                
                // Lấy poster_url từ movie object
                const fetchedMovie = {
                    ...json.movie,
                    // Giả sử API trả về poster_url ở cấp này, nếu không thì dùng thumb_url
                    poster_url: json.movie.poster_url || json.movie.thumb_url, 
                };
                setMovieDetail(fetchedMovie);
                
                const fetchedEpisodes = json.episodes;
                setEpisodes(fetchedEpisodes);

                const history = await loadPlaybackHistory(slug);
                let targetEpisode = null;
                let targetServerIndex = 0;
                let targetServerName = null;
                let initialPosition = 0;
                let isHistoryLoaded = false;

                if (history && history.episodeName) {
                    if (fetchedEpisodes[history.serverIndex]) {
                        const targetServer = fetchedEpisodes[history.serverIndex];
                        const episode = targetServer.server_data.find(ep => ep.name === history.episodeName);

                        if (episode) {
                            targetEpisode = episode;
                            targetServerIndex = history.serverIndex;
                            targetServerName = targetServer.server_name;
                            initialPosition = history.position;
                            isHistoryLoaded = true;
                            isPlayingRef.current = true;
                        }
                    }
                }

                if (!isHistoryLoaded) {
                    const firstServer = fetchedEpisodes[0];
                    if (firstServer?.server_data?.length > 0) {
                        targetEpisode = firstServer.server_data[0];
                        targetServerIndex = 0;
                        targetServerName = firstServer.server_name;
                        initialPosition = 0;
                        isPlayingRef.current = false;
                    }
                }

                if (targetEpisode) {
                    videoPositionRef.current = initialPosition;
                    setSelectedServerIndex(targetServerIndex);
                    setSelectedServerName(targetServerName);
                    await processAndSetM3u8(targetEpisode.link_m3u8, targetEpisode.name, targetServerIndex, targetServerName);
                } else {
                    setCurrentM3u8(null);
                    setSelectedEpisodeName(null);
                    setSelectedServerName(null);
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
    // ---------------------------------------------------
    // KẾT THÚC CẬP NHẬT
    // ---------------------------------------------------

    const processAndSetM3u8 = async (link_m3u8, episodeName, serverIndex, serverName) => {

        if (link_m3u8 === currentM3u8 && episodeName === selectedEpisodeName && serverIndex === selectedServerIndex) {
            return;
        }

        setCurrentM3u8(null);
        setIsManifestProcessing(true);

        try {
            const processedUrl = await fetchAndProcessPlaylist(link_m3u8);

            setCurrentM3u8(processedUrl);
            setSelectedEpisodeName(episodeName);
            setSelectedServerIndex(serverIndex);
            setSelectedServerName(serverName);

        } catch (error) {
            setCurrentM3u8(link_m3u8);
            setSelectedEpisodeName(episodeName);
            setSelectedServerIndex(serverIndex);
            setSelectedServerName(serverName);
        } finally {
            setIsManifestProcessing(false);
        }
    };

    const handleEpisodeSelect = async (link, episodeName, serverIndex, serverName) => {
        videoPositionRef.current = 0;
        isPlayingRef.current = true;
        await processAndSetM3u8(link, episodeName, serverIndex, serverName);
    };

    const handleServerSelect = async (serverIndex) => {
        const newServer = episodes[serverIndex];
        if (!newServer || !newServer.server_data) return;

        const currentEpisodeName = selectedEpisodeName;
        const newServerName = newServer.server_name;

        const newEpisode = newServer.server_data.find((ep) => ep.name === currentEpisodeName);
        const targetEpisode = newEpisode || newServer.server_data[0];

        const isSameEpisode = targetEpisode && targetEpisode.name === selectedEpisodeName && serverIndex === selectedServerIndex;

        if (!isSameEpisode) {
            videoPositionRef.current = 0;
            isPlayingRef.current = true;
        }

        if (targetEpisode) {
            await processAndSetM3u8(targetEpisode.link_m3u8, targetEpisode.name, serverIndex, newServerName);
        } else {
             setSelectedServerIndex(serverIndex);
             setSelectedServerName(newServerName);
             setCurrentM3u8(null);
        }
    };

    const goToPrevEpisode = useCallback(() => {
        const currentServer = episodes[selectedServerIndex];
        if (!currentServer || !currentServer.server_data || !selectedEpisodeName || selectedServerName === null) return;

        const currentEpisodeIndex = currentServer.server_data.findIndex(ep => ep.name === selectedEpisodeName);

        if (currentEpisodeIndex > 0) {
            const prevEpisode = currentServer.server_data[currentEpisodeIndex - 1];
            handleEpisodeSelect(prevEpisode.link_m3u8, prevEpisode.name, selectedServerIndex, selectedServerName);
        }
    }, [episodes, selectedServerIndex, selectedEpisodeName, selectedServerName]);

    const goToNextEpisode = useCallback(() => {
        const currentServer = episodes[selectedServerIndex];
        if (!currentServer || !currentServer.server_data || !selectedEpisodeName || selectedServerName === null) return;

        const currentEpisodeIndex = currentServer.server_data.findIndex(ep => ep.name === selectedEpisodeName);

        if (currentEpisodeIndex < currentServer.server_data.length - 1) {
            const nextEpisode = currentServer.server_data[currentEpisodeIndex + 1];
            handleEpisodeSelect(nextEpisode.link_m3u8, nextEpisode.name, selectedServerIndex, selectedServerName);
        }
    }, [episodes, selectedServerIndex, selectedEpisodeName, selectedServerName]);

    const handleSortToggle = useCallback(() => {
        setSortOrder(prevOrder => (prevOrder === 'desc' ? 'asc' : 'desc'));
    }, []);

    const currentServerData = episodes[selectedServerIndex]?.server_data;

    const sortedEpisodes = useMemo(() => {
        let filtered = currentServerData;

        if (searchQuery && filtered) {
            const lowerCaseQuery = searchQuery.toLowerCase();
            filtered = filtered.filter(
                ep => ep.name.toLowerCase().includes(lowerCaseQuery)
            );
        }

        if (filtered) {
            const sortedArray = [...filtered];

            if (sortOrder === 'desc') {
                sortedArray.reverse();
            }

            return sortedArray;
        }
        return [];
    }, [currentServerData, searchQuery, sortOrder]);

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
                    onPress={() => {
                        handleServerSelect(index);
                        setSearchQuery('');
                    }}
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
        const isSelected = episode.name === selectedEpisodeName;

        return (
            <TouchableOpacity
                style={[
                    styles.episodeButton,
                    isSelected && styles.selectedEpisodeButton,
                ]}
                onPress={() => handleEpisodeSelect(episode.link_m3u8, episode.name, selectedServerIndex, selectedServerName)}
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
            keyExtractor={item => item.name}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.episodesRow}
        />
    );

    const renderEpisodes = () => {
        const currentServer = episodes[selectedServerIndex];

        return (
            <View style={styles.episodeSection}>
                <Text style={styles.sectionHeader}>Danh sách tập ({selectedServerName || 'Đang tải...'})</Text>

                {renderServerButtons()}

                <EpisodeSearchControls
                    sortOrder={sortOrder}
                    handleSortToggle={handleSortToggle}
                    setSearchQuery={setSearchQuery}
                    styles={styles}
                />

                {searchQuery && (
                    <View style={styles.searchStatus}>
                        <Text style={styles.searchStatusText}>
                            Tìm thấy {sortedEpisodes.length} kết quả cho: {searchQuery}
                        </Text>
                        <TouchableOpacity onPress={() => {setSearchQuery('');}}>
                            <Ionicons name="close-circle" size={20} color="#FF5555" />
                        </TouchableOpacity>
                    </View>
                )}

                {currentServer && sortedEpisodes ? (
                    <View style={styles.currentEpisodeListContainer}>
                        {sortedEpisodes.length > 0 ? (
                            renderEpisodeList(sortedEpisodes)
                        ) : (
                            <Text style={styles.noEpisodesText}>
                                {searchQuery ? `Không tìm thấy tập phim '${searchQuery}'` : 'Không có dữ liệu tập phim.'}
                            </Text>
                        )}
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
                <Text style={styles.content} numberOfLines={undefined}>
                {(movieDetail.content || '').replace(/<[^>]+>/g, '')}
                </Text>

                {movieDetail.director && movieDetail.director.length > 0 && movieDetail.director[0] !== 'Đang cập nhật' && (
                    <Text style={styles.metaText}>
                        🎬 Đạo diễn: <Text style={{fontWeight: 'normal'}}>{movieDetail.director.join(', ')}</Text>
                    </Text>
                )}

                {movieDetail.actor && movieDetail.actor.length > 0 && (
                    <Text style={styles.metaText}>
                        🌟 Diễn viên: <Text style={{fontWeight: 'normal'}}>{movieDetail.actor.slice(0, 10).join(', ')}{movieDetail.actor.length > 10 ? ', ...' : ''}</Text>
                    </Text>
                )}

                {movieDetail.country && movieDetail.country.length > 0 && (
                    <Text style={styles.metaText}>
                        🌍 Quốc gia: <Text style={{fontWeight: 'normal'}}>{movieDetail.country.map((c) => c.name).join(', ')}</Text>
                    </Text>
                )}

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
                        selectedServerIndex={selectedServerIndex}
                        selectedServerName={selectedServerName}
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
    metaText: {
        fontSize: 14,
        color: '#00FF7F',
        marginBottom: 5,
        fontFamily: 'Roboto-Bold',
    },
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
    },

    episodeControls: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        zIndex: 1, 
    },
    sortButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#383838',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 8,
        marginRight: 10,
    },
    sortButtonText: {
        color: '#FFD700',
        marginLeft: 5,
        fontFamily: 'Roboto-Bold',
        fontSize: 14,
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#2E2E2E', 

        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#444',
    },
    searchInput: {
        flex: 1,
        color: '#FFFFFF',
        paddingVertical: 10,
        paddingLeft: 12,
        paddingRight: 5, 
        fontFamily: 'Roboto-Regular',
        fontSize: 14,
    },

    clearSearchButton: {
        padding: 5,
    },
    searchButton: {
        backgroundColor: '#FFD700',
        padding: 10, 
        borderRadius: 7, 
        marginLeft: 5, 
        marginRight: 2,
    },
    searchStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 8,
        backgroundColor: '#282828',
        borderRadius: 6,
        marginBottom: 10,
    },
    searchStatusText: {
        color: '#FFFFFF',
        fontFamily: 'Roboto-Regular',
        fontSize: 14,
    },
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
