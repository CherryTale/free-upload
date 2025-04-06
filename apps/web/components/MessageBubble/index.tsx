"use client"

import React from "react";
import { CopyTwoTone, CopyFilled } from "@ant-design/icons";
import DOMPurify from "dompurify";
import { message as antdMessage } from "antd";
import "./index.css";
import { Message } from '../../types/message';

interface MessageBubbleProps {
    from: string;
    isOwnMessage: boolean;
    isServerMessage: boolean;
    messageIndex: number;
    message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
    isOwnMessage,
    isServerMessage,
    messageIndex,
    message,
}) => {
    const [messageApi, contextHolder] = antdMessage.useMessage();

    // 复制富文本内容
    const handleCopyHTML = async (msg: string): Promise<void> => {
        try {
            // 使用 DOMParser 将字符串转换为 HTML 文档
            const parser = new DOMParser();
            const doc = parser.parseFromString(msg, "text/html");

            // 移除所有内联样式中的背景色
            const elements = doc.body.querySelectorAll("*");
            elements.forEach(element => {
                // 如果有 `style` 属性，移除背景颜色相关样式
                if (element instanceof HTMLElement) {
                    element.style.backgroundColor = ""; // 移除背景色
                    element.style.color = "black"; // 移除背景色
                    element.style.removeProperty("background"); // 移除 background
                }
            });

            const sanitizedHTML = DOMPurify.sanitize(doc.body.innerHTML);
            if (navigator.clipboard) {
                const blob = new Blob([sanitizedHTML], { type: 'text/html' });
                const clipboardItem = new ClipboardItem({ 'text/html': blob });
                await navigator.clipboard.write([clipboardItem]);
            } else {
                const hiddenDiv = document.createElement('div');
                hiddenDiv.innerHTML = sanitizedHTML;
                hiddenDiv.style.position = 'absolute';
                hiddenDiv.style.left = '-9999px'; // 确保 div 不会出现在页面中
                document.body.appendChild(hiddenDiv);

                // 创建 Range 对象并选择 div 的内容
                const range = document.createRange();
                range.selectNodeContents(hiddenDiv);
                const selection = window.getSelection();
                selection?.removeAllRanges();
                selection?.addRange(range);

                try {
                    document.execCommand('copy');
                    messageApi.success("Copy successful!", 1);
                } catch (err) {
                    messageApi.error(`Failed to copy rich text: ${err}`, 1);
                }

                document.body.removeChild(hiddenDiv);
                selection?.removeAllRanges();
            }
        } catch (err) {
            console.error('Failed to copy: ', err);
        }
    };

    // 复制纯文本内容，并使用 fallback 方案
    const handleCopyText = async (msg: string): Promise<void> => {
        try {
            const plainText = DOMPurify.sanitize(msg, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }); // 提取纯文本
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(plainText);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = plainText;
                textArea.style.position = 'absolute';
                textArea.style.left = '-9999px'; // 确保 textarea 不会影响页面布局
                document.body.appendChild(textArea);

                textArea.select(); // 选择 textarea 中的内容

                try {
                    document.execCommand('copy');
                    messageApi.success("Copy successful!", 1);
                } catch (err) {
                    messageApi.error(`Failed to copy plain text: ${err}`, 1);
                }

                document.body.removeChild(textArea);
            }
        } catch (err) {
            console.error('Failed to copy: ', err);
        }
    };

    return (
        <li className={`message-item ${isOwnMessage ? "from-me" : isServerMessage ? "from-server" : "from-other"}`}>
            {contextHolder}
            {message.type === 'text' ? (
                <span
                    className="message-content"
                    title={isServerMessage ? message.msg : ""}
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(message.msg) }}
                />
            ) : (
                <span className="message-content">{message.msg}</span>
            )}
            {!isServerMessage && message.type === 'text' && (
                <footer>
                    <CopyTwoTone
                        id={`copy-text-btn-${messageIndex}`}
                        className="copy-btn"
                        onClick={() => handleCopyText(message.msg)}
                        title="Copy plain text"
                    />
                    <CopyFilled
                        id={`copy-html-btn-${messageIndex}`}
                        className="copy-btn-rich"
                        onClick={() => handleCopyHTML(message.msg)}
                        title="Copy rich text"
                    />
                </footer>
            )}
        </li>
    );
};

export default MessageBubble;
