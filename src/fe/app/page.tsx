"use client"

import { io, Socket } from "socket.io-client";
import React, { useEffect, useState, useRef } from "react";
import Upload from "../components/Upload";
import Chat, { ChatHandle } from "../components/Chat";
import Share from "../components/Share";

const HomeComponent: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const chatRef = useRef<ChatHandle>(null); // 创建 ref 来获取 Chat 组件的引用

  useEffect(() => {
    const newSocket = io(window.location.origin);
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return (<>
    <Chat ref={chatRef} socket={socket} >
      {chatRef.current && <>
        <Upload {...chatRef.current} socket={socket} />
        <Share  {...chatRef.current} socket={socket} />
      </>}
    </Chat>
  </>);
};

export default HomeComponent;
