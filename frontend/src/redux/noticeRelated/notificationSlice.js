import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const API_URL = "http://localhost:5000/api/notifications";

// Async thunks
export const fetchNotifications = createAsyncThunk(
  "notifications/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(API_URL);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch notifications");
    }
  }
);

export const fetchUnreadCount = createAsyncThunk(
  "notifications/fetchUnreadCount",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/unread-count`);
      return response.data.unreadCount;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch unread count");
    }
  }
);

export const markAllNotificationsAsRead = createAsyncThunk(
  "notifications/markAllAsRead",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.put(`${API_URL}/mark-all-read`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to mark notifications as read");
    }
  }
);

export const markNotificationAsRead = createAsyncThunk(
  "notifications/markAsRead",
  async (notificationId, { rejectWithValue }) => {
    try {
      await axios.put(`${API_URL}/${notificationId}/read`);
      return notificationId;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to mark notification as read");
    }
  }
);

export const deleteAllNotifications = createAsyncThunk(
  "notifications/deleteAll",
  async (_, { rejectWithValue }) => {
    try {
      await axios.delete(API_URL);
      return [];
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to delete notifications");
    }
  }
);

export const createNotification = createAsyncThunk(
  "notifications/create",
  async (notificationData, { rejectWithValue }) => {
    try {
      const response = await axios.post(API_URL, notificationData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to create notification");
    }
  }
);

const initialState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
};

const notificationSlice = createSlice({
  name: "notification",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    addLocalNotification: (state, action) => {
      state.notifications.unshift(action.payload);
      state.unreadCount += 1;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch notifications
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.notifications = action.payload;
        state.unreadCount = action.payload.filter(notif => !notif.read).length;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Fetch unread count
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload;
      })
      
      // Mark all as read
      .addCase(markAllNotificationsAsRead.pending, (state) => {
        state.loading = true;
      })
      .addCase(markAllNotificationsAsRead.fulfilled, (state) => {
        state.loading = false;
        state.notifications = state.notifications.map(notif => ({
          ...notif,
          read: true
        }));
        state.unreadCount = 0;
      })
      .addCase(markAllNotificationsAsRead.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Mark one as read
      .addCase(markNotificationAsRead.fulfilled, (state, action) => {
        const notifIndex = state.notifications.findIndex(
          (notif) => notif._id === action.payload
        );
        if (notifIndex !== -1) {
          state.notifications[notifIndex].read = true;
          state.unreadCount = state.unreadCount > 0 ? state.unreadCount - 1 : 0;
        }
      })
      
      // Delete all notifications
      .addCase(deleteAllNotifications.fulfilled, (state) => {
        state.notifications = [];
        state.unreadCount = 0;
      })
      
      // Create notification
      .addCase(createNotification.fulfilled, (state, action) => {
        state.notifications.unshift(action.payload);
        state.unreadCount += 1;
      });
  },
});

export const { clearError, addLocalNotification } = notificationSlice.actions;
export default notificationSlice.reducer;