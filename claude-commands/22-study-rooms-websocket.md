Study rooms exist in DB and API but have no real-time functionality. Add WebSocket-based live collaboration.

Backend steps:
1. Add WebSocket endpoint in FastAPI at /api/v1/ws/rooms/{room_id}:
   - Auth: accept Clerk JWT as query param (?token=...) since WebSocket headers are limited
   - Track connected users per room in Redis: room:{room_id}:users → sorted set by join_time
   - Message types (JSON protocol):
     * user_joined / user_left: { type, user_id, display_name, avatar }
     * chat_message: { type, user_id, content, timestamp }
     * whiteboard_draw: { type, stroke_data } — canvas path data
     * doc_pointer: { type, user_id, file_id, page, scroll_y } — "I'm reading page 3"
   - Broadcast all messages to all connected users in the room
   - Use Redis pub/sub so broadcasts work across multiple API instances

2. Update rooms table: add current_user_count column, update on join/leave

Frontend steps:
3. Create useRoomSocket(roomId) hook in lib/hooks/:
   - Manages WebSocket connection, reconnection, and message dispatch
   - Exposes: { connectedUsers, messages, sendMessage, sendDocPointer, isConnected }

4. Build the study room page at groups/[groupId]/rooms/[roomId]:
   - Left panel: connected users list with avatars and green "online" dot
   - Center: shared chat (casual study chat, separate from RAG chat)
   - Right panel: "Ce que je lis" — which file and page each user is currently on
   - Bottom: shared whiteboard canvas (HTML Canvas, draw with mouse/touch, synced live)

5. "Inviter" button copies invite link and optionally sends via WhatsApp

Show complete WebSocket endpoint, Redis pub/sub, useRoomSocket hook, and the full room page layout.
