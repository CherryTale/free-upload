"use client"

import React, { useState, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import { Button } from "antd";
import { ChatHandle } from '../Chat';
import "./index.css";

interface PeerConnections {
    [key: string]: RTCPeerConnection;
}

interface ShareProps {
    socket: Socket | null;
    setMessageList: ChatHandle["setMessageList"];
    addMessage: ChatHandle["addMessage"];
    updateMessage: ChatHandle["updateMessage"];
}

const Share: React.FC<ShareProps> = ({ socket, addMessage, updateMessage }) => {
    const peerConnectionsRef = useRef<PeerConnections>({});
    const localStreamRef = useRef<MediaStream | null>(null);
    const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
    const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
    const [canShare, setCanShare] = useState<boolean>(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isSharing, setIsSharing] = useState<boolean>(false);

    useEffect(() => {
        if (videoStream) {
            addMessage({
                id: -1,
                from: socket?.id || "share",
                msg: <video autoPlay muted ref={videoRef} />
            })
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = videoStream;
                }
            }, 1000);
        }
    }, [videoStream])

    useEffect(() => {
        if (audioStream) {
            addMessage({
                id: -2,
                from: socket?.id || "share",
                msg: <audio autoPlay ref={audioRef} />
            })
            setTimeout(() => {
                if (audioRef.current) {
                    audioRef.current.srcObject = audioStream;
                }
            }, 1000);
        }
    }, [audioStream])

    useEffect(() => {
        setCanShare(!!MediaRecorder && !!(navigator?.mediaDevices?.getDisplayMedia))
    }, []);

    useEffect(() => {
        if (socket) {
            const handleNewPeer = (peerId: string) => {
                console.log('evt new-peer');
                const peerConnection = new RTCPeerConnection();
                peerConnectionsRef.current[peerId] = peerConnection;

                // 添加用于接收远程流的 transceiver
                peerConnection.addTransceiver("video", { direction: "recvonly" });
                peerConnection.addTransceiver("audio", { direction: "recvonly" });

                peerConnection.onicecandidate = (event) => {
                    console.log('onicecandidate');
                    if (event.candidate) {
                        socket.emit("ice-candidate", { candidate: event.candidate, peerId });
                    }
                };

                // 处理接收到的远程流
                peerConnection.ontrack = (event: RTCTrackEvent) => {
                    console.log('ontrack')
                    const stream = event.streams[0];

                    if (event.track.kind === "video") {
                        setVideoStream(stream);
                    } else if (event.track.kind === "audio") {
                        setAudioStream(stream);
                    }
                };

                peerConnection
                    .createOffer()
                    .then(offer => peerConnection.setLocalDescription(offer))
                    .then(() => socket.emit("offer", { offer: peerConnection.localDescription, peerId }));
            };

            const handleOffer = async ({ offer, peerId }: { offer: RTCSessionDescription; peerId: string }) => {
                console.log('evt offer');
                const peerConnection = new RTCPeerConnection();
                peerConnectionsRef.current[peerId] = peerConnection;

                peerConnection.onicecandidate = (event) => {
                    if (event.candidate) {
                        socket?.emit("ice-candidate", { candidate: event.candidate, peerId });
                    }
                };

                // 添加本地流
                const localStream = localStreamRef.current;
                if (localStream) {
                    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));
                }

                await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                socket?.emit("answer", { answer: peerConnection.localDescription, peerId });
            };

            const handleAnswer = async ({ answer, peerId }: { answer: RTCSessionDescription; peerId: string }) => {
                console.log('evt answer');
                await peerConnectionsRef.current[peerId].setRemoteDescription(new RTCSessionDescription(answer));
            };

            const handleIceCandidate = ({ candidate, peerId }: { candidate: RTCIceCandidate; peerId: string }) => {
                console.log('evt ice-candidate');
                peerConnectionsRef.current[peerId].addIceCandidate(new RTCIceCandidate(candidate));
            };

            const handlePeerDisconnected = (peerId: string) => {
                console.log("peer-disconnected");
                const peerConnection = peerConnectionsRef.current[peerId];
                if (peerConnection) {
                    peerConnection.close(); // 关闭连接
                    delete peerConnectionsRef.current[peerId]; // 移除引用
                }
                console.log(peerConnectionsRef.current);
                if (Object.keys(peerConnectionsRef.current).length === 0) {
                    setVideoStream(null);
                    setAudioStream(null);
                }
            }

            socket.on("new-peer", handleNewPeer);
            socket.on("offer", handleOffer);
            socket.on("answer", handleAnswer);
            socket.on("ice-candidate", handleIceCandidate);
            socket.on("stop-share", handleStopShare);
            socket.on("peer-disconnected", handlePeerDisconnected);

            return () => {
                socket.off("new-peer", handleNewPeer);
                socket.off("offer", handleOffer);
                socket.off("answer", handleAnswer);
                socket.off("ice-candidate", handleIceCandidate);
                socket.off("stop-share", handleStopShare);
                socket.off("peer-disconnected", handlePeerDisconnected);

                handleStopShare();
            };
        }
    }, [socket]);

    const handleStopShare = () => {
        // 更新视频和音频消息内容为“分享已结束”
        updateMessage(-1, (
            <div style={{ color: "red" }}>
                屏幕分享已结束
            </div>
        ));

        updateMessage(-2, (
            <div style={{ color: "red" }}>
                音频分享已结束
            </div>
        ));

        // 停止视频和音频流的播放
        setVideoStream(null);
        setAudioStream(null);

        // 停止所有本地流
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }

        // 停止所有 PeerConnection 并清理资源
        Object.values(peerConnectionsRef.current).forEach(peer => {
            peer.getSenders().forEach(sender => peer.removeTrack(sender));
            peer.close();
        });
        peerConnectionsRef.current = {};

        setIsSharing(false);
    };

    const handleStartShare = async () => {
        try {
            localStreamRef.current = await navigator.mediaDevices.getDisplayMedia({ video: true });

            // 监听本地流中所有视频和音频轨道的 `onended` 事件
            localStreamRef.current.getTracks().forEach(track => {
                track.onended = () => {
                    console.log("本地流轨道已结束，停止屏幕共享。");
                    handleStopShare(); // 自动停止分享
                };
            });

            socket?.emit("start-share");
            setIsSharing(true);
        } catch (err) {
            console.error("Error accessing display media: ", err);
        }
    };

    return (<>
        {canShare && !videoStream && !audioStream && (isSharing ?
            < Button type="primary" onClick={() => {
                handleStopShare();
                socket?.emit("stop-share");
            }}>
                停止分享屏幕
            </Button >
            :
            < Button type="primary" onClick={handleStartShare}>
                点击开始分享屏幕
            </Button >)
        }
    </>);
};

export default Share;
