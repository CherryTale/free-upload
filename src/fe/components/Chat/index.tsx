"use client";

import dynamic from "next/dynamic";
import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Button } from "antd";
import { Socket } from "socket.io-client";
import MessageBubble from "../MessageBubble/index";
import "./index.css";
import "react-quill/dist/quill.snow.css";
const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });

interface ChatProps {
    socket: Socket | null;
    children: React.ReactNode;
}

interface Message {
    id: number;
    from: string;
    msg: React.ReactNode; // 允许传入 React 组件
}

// 定义 ChatHandle 接口，用于描述暴露的函数
export interface ChatHandle {
    addMessage: (newMessage: Message) => void;
    setMessageList: (messages: Message[]) => void;
    updateMessage: (id: number, updatedMsg: React.ReactNode) => void;
}

const Chat = forwardRef<ChatHandle, ChatProps>(({ socket, children }, ref) => {
    const [message, setMessage] = useState<string>(""); // 当前输入消息
    const [messageList, setMessageList] = useState<Message[]>([]); // 消息列表
    const messageListRef = useRef<HTMLUListElement>(null);

    useImperativeHandle(ref, () => ({
        addMessage: (newMessage: Message) => {
            setMessageList((prevMessages) => [...prevMessages, newMessage]);
        },
        setMessageList,
        updateMessage: (id: number, updatedMsg: React.ReactNode) => {
            setMessageList(prevMessages => {
                const updatedMessages = prevMessages.map(msg =>
                    msg.id === id ? { ...msg, msg: updatedMsg } : msg
                );
                return updatedMessages;
            });
        },
    }));

    useEffect(() => {
        if (socket) {
            const handleMessage = (message: Message): void => {
                setMessageList(prevMessages => [...prevMessages, message]);
            };
            const handleHistory = (history: Message[]): void => {
                setMessageList(history);
            };

            socket.on("chat message", handleMessage);
            socket.on("chat history", handleHistory);

            return () => {
                socket.off("chat message", handleMessage);
                socket.off("chat history", handleHistory);
            };
        }
    }, [socket]);

    useEffect(() => {
        messageListRef.current?.scrollTo({
            top: messageListRef.current.scrollHeight,
            behavior: "smooth",
        });
    }, [messageList]);

    const handleSubmit = (): void => {
        const plainText = message.replace(/<[^>]+>/g, "").trim();
        if (!plainText) {
            return;
        }
        socket?.emit("chat message", message);
        setMessage("");
    };

    return (
        <div id="copy" className="panel">
            <div className="feature-buttons">{children}</div>
            <div className="hr"></div>
            <ul id="messages" ref={messageListRef}>
                {messageList.map((message, index) => (
                    <MessageBubble
                        key={message.id}
                        from={message.from}
                        isOwnMessage={message.from === socket?.id}
                        isServerMessage={message.from === "server"}
                        messageIndex={index}
                    >
                        {message.msg}
                    </MessageBubble>
                ))}
            </ul>

            <div className="input-area">
                <ReactQuill
                    theme="snow"
                    value={message}
                    onChange={setMessage}
                    placeholder="Enter a message..."
                />
                <Button type="primary" onClick={handleSubmit} className="send-button">
                    Send
                </Button>
            </div>
        </div>
    );
});

Chat.displayName = "Chat";

export default Chat;
