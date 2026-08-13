import logging
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, status
from sqlalchemy.orm import Session

from app.db import get_db, SessionLocal
from app.models.models import User, Contact, ConversationParticipant
from app.core.security import decode_token
from app.ws.manager import manager
from app.services.messages import create_and_broadcast_message

logger = logging.getLogger("uvicorn.error")

router = APIRouter(tags=["WebSockets"])

@router.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str, db: Session = Depends(get_db)):
    """
    WebSocket endpoint that authenticates a user via a path JWT token,
    accepts the connection, manages active sessions, and broadcasts presence events.
    """
    # 1. Validate JWT Token
    payload = decode_token(token)
    if not payload:
        logger.warning("Rejected WebSocket connection: Invalid JWT token signature")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid authentication token")
        return
        
    username = payload.get("sub")
    if not username:
        logger.warning("Rejected WebSocket connection: Token missing sub claim")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token payload")
        return
        
    # Get user profile
    user = db.query(User).filter(User.username == username).first()
    if not user:
        logger.warning(f"Rejected WebSocket connection: User '{username}' not found in database")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Authenticated user not found")
        return

    # 2. Query contact list to know who to notify about presence
    # Find people this user added, and people who added this user
    contacts_owned = db.query(Contact).filter(Contact.owner_id == user.id).all()
    contacts_added = db.query(Contact).filter(Contact.contact_user_id == user.id).all()
    
    contact_ids = set()
    for c in contacts_owned:
        contact_ids.add(c.contact_user_id)
    for c in contacts_added:
        contact_ids.add(c.owner_id)
    contact_ids = list(contact_ids)

    # 3. Accept and register connection
    await manager.connect(user.id, websocket)

    # 4. Mark user online & Broadcast presence
    try:
        user.is_online = True
        db.commit()
        
        presence_event = {
            "type": "presence",
            "user_id": user.id,
            "is_online": True,
            "last_seen": None
        }
        await manager.broadcast_to_users(contact_ids, presence_event)
    except Exception as e:
        logger.error(f"Error marking user {user.id} online: {str(e)}")
        db.rollback()

    # 5. Receive message loop
    try:
        while True:
            # Wait for JSON payload from client
            data = await websocket.receive_json()
            
            logger.info(f"WebSocket client event received from user {user.id} ({user.username}): {data}")
            
            event_type = data.get("type")
            if not event_type:
                logger.warning(f"Received malformed WS message without 'type' key from user {user.id}")
                continue
                
            if event_type == "send_message":
                conversation_id = data.get("conversation_id")
                content = data.get("content")
                reply_to_id = data.get("reply_to_id")
                
                if not conversation_id or not content:
                    logger.warning(f"Malformed send_message event payload from user {user.id}: {data}")
                    continue
                
                # Check if the user is a participant of this conversation
                is_participant = db.query(ConversationParticipant).filter(
                    ConversationParticipant.conversation_id == conversation_id,
                    ConversationParticipant.user_id == user.id
                ).first()
                
                if not is_participant:
                    logger.warning(f"User {user.id} attempted to send message to unauthorized conversation {conversation_id}")
                    continue
                
                try:
                    await create_and_broadcast_message(
                        db=db,
                        conversation_id=conversation_id,
                        sender_id=user.id,
                        content=content,
                        reply_to_id=reply_to_id
                    )
                except Exception as e:
                    logger.error(f"Failed to process WS send_message event for user {user.id}: {str(e)}")
                    
            elif event_type == "typing":
                conversation_id = data.get("conversation_id")
                is_typing = data.get("is_typing", False)
                
                if not conversation_id:
                    continue
                    
                # Fetch participant user IDs to broadcast typing status
                participants = db.query(ConversationParticipant).filter(
                    ConversationParticipant.conversation_id == conversation_id
                ).all()
                other_user_ids = [p.user_id for p in participants if p.user_id != user.id]
                
                typing_payload = {
                    "type": "typing",
                    "conversation_id": conversation_id,
                    "user_id": user.id,
                    "is_typing": is_typing
                }
                await manager.broadcast_to_users(other_user_ids, typing_payload)
                
            elif event_type == "read":
                conversation_id = data.get("conversation_id")
                message_id = data.get("message_id")
                
                if not conversation_id or not message_id:
                    continue
                    
                # Verify participant access
                is_part = db.query(ConversationParticipant).filter(
                    ConversationParticipant.conversation_id == conversation_id,
                    ConversationParticipant.user_id == user.id
                ).first()
                
                if not is_part:
                    continue
                    
                try:
                    from app.services.receipts import mark_conversation_as_read
                    await mark_conversation_as_read(db, conversation_id, user.id, message_id)
                except Exception as e:
                    logger.error(f"Failed to process WS read event for user {user.id}: {str(e)}")
            else:
                logger.warning(f"Received unsupported client event type '{event_type}' from user {user.id}")
                
    except WebSocketDisconnect:
        # Handle cleanup on drop
        manager.disconnect(user.id, websocket)
        
        # Check if user has no remaining active sessions
        if user.id not in manager.active_connections:
            # We open a fresh connection to the database to ensure we can update user status reliably
            db_cleanup = SessionLocal()
            try:
                db_user = db_cleanup.query(User).filter(User.id == user.id).first()
                if db_user:
                    db_user.is_online = False
                    db_user.last_seen = datetime.utcnow()
                    db_cleanup.commit()
                    
                    logger.info(f"User {user.id} ({user.username}) is now fully offline. Last seen: {db_user.last_seen}")
                    
                    # Broadcast offline presence
                    offline_event = {
                        "type": "presence",
                        "user_id": user.id,
                        "is_online": False,
                        "last_seen": db_user.last_seen.isoformat()
                    }
                    await manager.broadcast_to_users(contact_ids, offline_event)
            except Exception as e:
                logger.error(f"Error marking user {user.id} offline on disconnect: {str(e)}")
                db_cleanup.rollback()
            finally:
                db_cleanup.close()
