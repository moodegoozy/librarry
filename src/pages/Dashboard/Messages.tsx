import React, { useState, useEffect } from "react";
import {
  Search,
  Mail,
  MailOpen,
  Trash2,
  Inbox,
  Clock,
  Loader,
  X,
} from "lucide-react";
import {
  subscribeToContactMessages,
  markMessageRead,
  deleteContactMessage,
} from "../../services/firestore";
import type { ContactMessage } from "../../services/firestore";
import "./Messages.css";

const Messages: React.FC = () => {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(
    null,
  );
  const [loading, setLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  useEffect(() => {
    const unsubscribe = subscribeToContactMessages((msgs) => {
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, []);

  const filteredMessages = messages.filter((m) => {
    const matchesSearch =
      m.name?.includes(searchQuery) ||
      m.email?.includes(searchQuery) ||
      m.subject?.includes(searchQuery) ||
      m.message?.includes(searchQuery);
    const matchesFilter =
      filter === "all" ||
      (filter === "unread" && !m.read) ||
      (filter === "read" && m.read);
    return matchesSearch && matchesFilter;
  });

  const unreadCount = messages.filter((m) => !m.read).length;

  const handleOpen = async (msg: ContactMessage) => {
    setSelectedMessage(msg);
    if (!msg.read && msg.id) {
      await markMessageRead(msg.id);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الرسالة؟")) return;
    setLoading(id);
    try {
      await deleteContactMessage(id);
      if (selectedMessage?.id === id) setSelectedMessage(null);
    } catch (error) {
      console.error("Error deleting message:", error);
      alert("حدث خطأ أثناء حذف الرسالة");
    } finally {
      setLoading(null);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date instanceof Date ? date : new Date(date));
  };

  return (
    <div className="messages-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>رسائل العملاء</h1>
        <p>
          {unreadCount > 0
            ? `${unreadCount} رسالة غير مقروءة`
            : "لا توجد رسائل جديدة"}
        </p>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="ابحث في الرسائل..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-buttons">
          <select
            className="filter-select"
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as "all" | "unread" | "read")
            }
          >
            <option value="all">كل الرسائل</option>
            <option value="unread">غير مقروءة ({unreadCount})</option>
            <option value="read">مقروءة</option>
          </select>
        </div>
      </div>

      {/* Messages List */}
      <div className="messages-card">
        {filteredMessages.length === 0 ? (
          <div className="empty-state">
            <Inbox size={48} />
            <p>لا توجد رسائل</p>
            <span>سيتم عرض رسائل العملاء هنا عند استقبالها</span>
          </div>
        ) : (
          <div className="messages-list">
            {filteredMessages.map((msg) => (
              <div
                key={msg.id}
                className={`message-item ${!msg.read ? "unread" : ""} ${selectedMessage?.id === msg.id ? "selected" : ""}`}
                onClick={() => handleOpen(msg)}
              >
                <div className="message-icon">
                  {msg.read ? <MailOpen size={20} /> : <Mail size={20} />}
                </div>
                <div className="message-content">
                  <div className="message-header-row">
                    <strong className="message-sender">{msg.name}</strong>
                    <span className="message-date">
                      <Clock size={12} />
                      {formatDate(msg.createdAt)}
                    </span>
                  </div>
                  <span className="message-subject">{msg.subject}</span>
                  <p className="message-preview">
                    {msg.message?.slice(0, 80)}...
                  </p>
                  <span className="message-email">{msg.email}</span>
                </div>
                <button
                  className="action-btn delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (msg.id) handleDelete(msg.id);
                  }}
                  disabled={loading === msg.id}
                >
                  {loading === msg.id ? (
                    <Loader className="spinner" size={16} />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Message Detail Modal */}
      {selectedMessage && (
        <div className="modal-overlay" onClick={() => setSelectedMessage(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedMessage.subject}</h2>
              <button
                className="close-btn"
                onClick={() => setSelectedMessage(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="message-detail">
                <div className="detail-row">
                  <span>المرسل:</span>
                  <strong>{selectedMessage.name}</strong>
                </div>
                <div className="detail-row">
                  <span>البريد:</span>
                  <strong>{selectedMessage.email}</strong>
                </div>
                {selectedMessage.phone && (
                  <div className="detail-row">
                    <span>الجوال:</span>
                    <strong>{selectedMessage.phone}</strong>
                  </div>
                )}
                <div className="detail-row">
                  <span>التاريخ:</span>
                  <strong>{formatDate(selectedMessage.createdAt)}</strong>
                </div>
                <div className="message-body">
                  <h4>نص الرسالة</h4>
                  <p>{selectedMessage.message}</p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-outline"
                style={{ color: "#ef4444", borderColor: "#ef4444" }}
                onClick={() =>
                  selectedMessage.id && handleDelete(selectedMessage.id)
                }
              >
                <Trash2 size={16} />
                حذف
              </button>
              <a
                href={`mailto:${selectedMessage.email}?subject=رد: ${selectedMessage.subject}`}
                className="btn btn-primary"
              >
                <Mail size={16} />
                رد بالبريد
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;
