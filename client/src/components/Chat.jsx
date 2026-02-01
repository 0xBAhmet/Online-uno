import React, { useState, useEffect, useRef } from 'react';

const Chat = ({ socket, myPlayerId, isOpen, onClose, messages, t }) => {
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSend = (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        socket.emit('chatMessage', {
            message: newMessage,
            playerId: myPlayerId
        });
        setNewMessage('');
    };

    if (!isOpen) return null;

    return (
        <div className="chat-overlay glass-panel">
            <div className="chat-header">
                <h3>💬 Chat</h3>
                <button onClick={onClose} className="chat-close-btn">✕</button>
            </div>

            <div className="chat-messages">
                {messages.length === 0 ? (
                    <div className="chat-empty">{t.startChatting || 'Mesajlaşmaya başla...'}</div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.senderId === myPlayerId;
                        return (
                            <div key={msg.id} className={`chat-message ${isMe ? 'me' : 'other'}`}>
                                <div className="chat-sender">{isMe ? (t.you || 'Sen') : msg.senderName}</div>
                                <div className="chat-text">{msg.text}</div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="chat-input-area">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={t.typeMessage || 'Mesaj yaz...'}
                    className="chat-input"
                    maxLength={100}
                />
                <button type="submit" className="chat-send-btn">➤</button>
            </form>
        </div>
    );
};

export default Chat;
