import React, { useState, useEffect } from "react";
import {
  Search,
  Shield,
  ShieldOff,
  User,
  Mail,
  Phone,
  Calendar,
  Loader,
} from "lucide-react";
import { subscribeToUsers, updateUserRole } from "../../services/firestore";
import type { User as UserType } from "../../types";
import "./Customers.css";

const Customers: React.FC = () => {
  const [users, setUsers] = useState<UserType[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const unsubscribe = subscribeToUsers((firestoreUsers) => {
      setUsers(firestoreUsers);
    });
    return () => unsubscribe();
  }, []);

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name?.includes(searchQuery) ||
      u.email?.includes(searchQuery) ||
      u.phone?.includes(searchQuery);
    const matchesRole = !roleFilter || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handleRoleChange = async (
    userId: string,
    newRole: "customer" | "admin",
  ) => {
    setLoading(userId);
    try {
      await updateUserRole(userId, newRole);
      alert(`تم تغيير الدور إلى ${newRole === "admin" ? "مدير" : "عميل"}`);
    } catch (error) {
      console.error("Error updating role:", error);
      alert("حدث خطأ أثناء تغيير الدور");
    } finally {
      setLoading(null);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  };

  return (
    <div className="customers-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>إدارة العملاء</h1>
        <p>عدد المستخدمين: {users.length}</p>
      </div>

      {/* Search */}
      <div className="filters-bar">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="ابحث عن عميل..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div className="filter-buttons">
          <select
            className="filter-select"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">كل الأدوار</option>
            <option value="admin">مدير</option>
            <option value="customer">عميل</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>المستخدم</th>
              <th>البريد</th>
              <th>الجوال</th>
              <th>الدور</th>
              <th>تاريخ التسجيل</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="user-cell">
                    <div className="user-avatar">
                      <User size={18} />
                    </div>
                    <span>{user.name || "بدون اسم"}</span>
                  </div>
                </td>
                <td>
                  <div className="email-cell">
                    <Mail size={14} />
                    <span>{user.email}</span>
                  </div>
                </td>
                <td>
                  <div className="phone-cell">
                    <Phone size={14} />
                    <span>{user.phone || "-"}</span>
                  </div>
                </td>
                <td>
                  <span className={`role-badge ${user.role}`}>
                    {user.role === "admin" ? "مدير" : "عميل"}
                  </span>
                </td>
                <td>
                  <div className="date-cell">
                    <Calendar size={14} />
                    <span>{formatDate(user.createdAt)}</span>
                  </div>
                </td>
                <td>
                  <div className="actions-cell">
                    {user.role === "customer" ? (
                      <button
                        className="action-btn promote"
                        title="ترقية إلى مدير"
                        onClick={() => handleRoleChange(user.id, "admin")}
                        disabled={loading === user.id}
                      >
                        {loading === user.id ? (
                          <Loader className="spinner" size={16} />
                        ) : (
                          <Shield size={16} />
                        )}
                        ترقية
                      </button>
                    ) : (
                      <button
                        className="action-btn demote"
                        title="إزالة صلاحية المدير"
                        onClick={() => handleRoleChange(user.id, "customer")}
                        disabled={loading === user.id}
                      >
                        {loading === user.id ? (
                          <Loader className="spinner" size={16} />
                        ) : (
                          <ShieldOff size={16} />
                        )}
                        إزالة
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="empty-state">
            <User size={50} />
            <p>لا يوجد مستخدمين</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <span className="pagination-info">
              عرض {(currentPage - 1) * itemsPerPage + 1}-
              {Math.min(currentPage * itemsPerPage, filteredUsers.length)} من{" "}
              {filteredUsers.length} مستخدم
            </span>
            <div className="pagination-buttons">
              <button
                className="pagination-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                السابق
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <button
                    key={page}
                    className={`pagination-btn ${currentPage === page ? "active" : ""}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ),
              )}
              <button
                className="pagination-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Customers;
