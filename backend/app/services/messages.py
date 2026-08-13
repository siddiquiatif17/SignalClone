import logging
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from app.models.models import (
    Message,
    Conversation,
    ConversationParticipant,
    MessageType,
    MessageReceipt,
    ReceiptStatus,
)
from app.ws.manager import manager

logger = logging.getLogger("uvicorn.error")

async def create_and_broadcast_message(
    db: Session,
    conversation_id: int,
    sender_id: int,
    content: str,
    reply_to_id: Optional[int] = None,
    message_type: MessageType = MessageType.TEXT
) -> Message:
    """
    Creates a new message record in the database, updates the conversation's
    updated_at timestamp, commits the transaction, and broadcasts a real-time
    WS 'new_message' event to all conversation participants.
    Also creates MessageReceipt records for other participants, marking them as
    'delivered' immediately if online, else 'sent'.
    """
    # 1. Create message model
    db_message = Message(
        conversation_id=conversation_id,
        sender_id=sender_id,
        content=content.strip(),
        message_type=message_type,
        reply_to_id=reply_to_id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        is_deleted=False
    )
    db.add(db_message)
    
    # 2. Update conversation modified timestamp
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conversation:
        conversation.updated_at = datetime.utcnow()
        
    db.commit()
    db.refresh(db_message)
    
    # 3. Create MessageReceipt records for other participants
    participants = db.query(ConversationParticipant).filter(
        ConversationParticipant.conversation_id == conversation_id
    ).all()
    
    delivered_receipts_to_notify = []
    for p in participants:
        if p.user_id == sender_id:
            continue
            
        is_online = p.user_id in manager.active_connections
        status = ReceiptStatus.DELIVERED if is_online else ReceiptStatus.SENT
        
        receipt = MessageReceipt(
            message_id=db_message.id,
            user_id=p.user_id,
            status=status,
            updated_at=datetime.utcnow()
        )
        db.add(receipt)
        
        if is_online:
            delivered_receipts_to_notify.append(p.user_id)
            
    db.commit()
    
    # 4. Construct JSON event payload matching MessageRead format
    message_data = {
        "id": db_message.id,
        "conversation_id": db_message.conversation_id,
        "sender_id": db_message.sender_id,
        "content": db_message.content,
        "message_type": db_message.message_type.value,
        "reply_to_id": db_message.reply_to_id,
        "created_at": db_message.created_at.isoformat(),
        "updated_at": db_message.updated_at.isoformat(),
        "is_deleted": db_message.is_deleted
    }
    
    event_payload = {
        "type": "new_message",
        "message": message_data
    }
    
    # 5. Broadcast to participants
    participant_user_ids = [p.user_id for p in participants]
    logger.info(f"Broadcasting message {db_message.id} to conversation {conversation_id} participants: {participant_user_ids}")
    await manager.broadcast_to_users(participant_user_ids, event_payload)
    
    # 6. Immediately notify the sender about any instant 'delivered' receipts
    for recipient_id in delivered_receipts_to_notify:
        receipt_update = {
            "type": "receipt_update",
            "message_id": db_message.id,
            "user_id": recipient_id,
            "status": "delivered"
        }
        await manager.send_to_user(sender_id, receipt_update)
        
    return db_message
