"use client";

import React, { useRef, ChangeEvent } from "react";
import { Button, Progress } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import "./index.css";
import chunkUploadFunc from './ChunkUpload';
import singleUploadFunc from './SingleUpload';
import { ParallelController } from './utils';
import { ChatHandle } from '../Chat';
import { Socket } from "socket.io-client";

const threshold: number = Math.pow(2, 30); // 1GB
const maxInParallel: number = 6;

interface UploadProps {
    socket: Socket | null;
    setMessageList: ChatHandle["setMessageList"];
    addMessage: ChatHandle["addMessage"];
    updateMessage: ChatHandle["updateMessage"];
}

const Upload: React.FC<UploadProps> = ({ addMessage, updateMessage, socket }) => {
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // 处理文件选择事件，并在选择后立即开始上传
    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const selectedFiles: File[] = event.target.files ? Array.from(event.target.files) : [];
        if (selectedFiles.length === 0) {
            console.error('No file selected.');
            return;
        }

        // 创建并发上传控制器
        const parallelController = new ParallelController(maxInParallel);

        // 上传所有文件并更新进度
        await uploadFiles(selectedFiles, parallelController);

        console.log('All uploads complete.');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // 上传文件，并更新进度
    const uploadFiles = async (files: File[], parallelController: ParallelController) => {
        const uploadPromises = files.map((file, index) => {
            // 为每个文件生成唯一的 messageId
            const messageId = Date.now() + index;

            // 创建一个新的消息气泡用于显示上传进度
            addMessage({
                id: messageId,
                from: socket?.id || "upload",
                type: "component",
                msg: (
                    <div>
                        <span>正在上传: {file.name}</span>
                        <Progress
                            percent={0}
                            status="active"
                        />
                    </div>
                ),
            });

            let uploadedSize: number = 0;

            const updateProgress = (progressValue: number, status: "active" | "success" | "exception" = "active") => {
                uploadedSize += progressValue;
                // 在更新进度时同时更新对应的对话气泡内容
                updateMessage(messageId, {
                    id: messageId,
                    from: socket?.id || "upload",
                    type: "component",
                    msg: (
                        <div>
                            <span>正在上传: {file.name}</span>
                            <Progress
                                percent={Math.floor((uploadedSize / file.size) * 100)}
                                status={status}
                            />
                        </div>
                    )
                });
            };

            if (file.size > threshold) {
                return chunkUploadFunc(file, parallelController, updateProgress);
            } else {
                return singleUploadFunc(file, parallelController, updateProgress);
            }
        });

        await Promise.all(uploadPromises);
    };

    // 触发隐藏的文件选择框
    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    return (<>
        <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: "none" }} // 隐藏 input
            onChange={handleFileChange}
            accept="*"
        />
        <Button
            icon={<UploadOutlined />}
            onClick={handleButtonClick}
            type="primary"
        >
            Upload
        </Button>
    </>);
};

export default Upload;
