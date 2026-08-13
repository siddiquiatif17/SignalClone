import logging
from typing import Dict, List
from fastapi import WebSocket

logger = logging.getLogger("uvicorn.error")

class ConnectionManager:
    def __init__(self):
        # Maps user_id -> List of active WebSockets (to support multiple tabs)
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        """
        Accepts the connection and registers it in the manager.
        """
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        logger.info(f"WebSocket connected for user {user_id}. Active sessions: {len(self.active_connections[user_id])}")

    def disconnect(self, user_id: int, websocket: WebSocket):
        """
        Deregisters a socket on disconnection.
        """
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
                logger.info(f"WebSocket disconnected for user {user_id}. Remaining sessions: {len(self.active_connections[user_id])}")
            
            # Clean up key if no more active connections
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                logger.info(f"All WebSocket connections closed for user {user_id}.")

    async def send_to_user(self, user_id: int, data: dict):
        """
        Sends JSON data to all active sockets belonging to a specific user.
        """
        if user_id in self.active_connections:
            # We copy the list to prevent concurrent modification errors if a socket drops while iterating
            sockets = list(self.active_connections[user_id])
            for websocket in sockets:
                try:
                    await websocket.send_json(data)
                except Exception as e:
                    logger.error(f"Failed to send WS message to user {user_id}: {str(e)}")
                    # Clean up broken connection
                    self.disconnect(user_id, websocket)

    async def broadcast_to_users(self, user_ids: List[int], data: dict):
        """
        Sends JSON data to multiple users.
        """
        import traceback
        for user_id in user_ids:
            try:
                await self.send_to_user(user_id, data)
            except Exception as e:
                logger.error(f"Error broadcasting WS event to user {user_id}: {str(e)}")
                logger.error(traceback.format_exc())

# Global connection manager instance
manager = ConnectionManager()
