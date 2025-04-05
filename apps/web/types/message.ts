import { ReactNode } from 'react';

export interface BaseMessage {
    id: number;
    from: string;
}

export interface TextMessage extends BaseMessage {
    type: 'text';
    msg: string;
}

export interface ComponentMessage extends BaseMessage {
    type: 'component';
    msg: ReactNode;
}

export type Message = TextMessage | ComponentMessage; 